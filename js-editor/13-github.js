/* ============================================================
   GITHUB API MODULE (BATCH SINGLE-COMMIT DRIVER)
   ============================================================ */

async function uploadBatchToGitHub(token, owner, repo, files, commitMessage) {
    if (!files || files.length === 0) return true;

    const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    };

    try {
        console.log(`Starting batch upload of ${files.length} files in a single atomic commit...`);

        // 1. Get latest commit SHA of main branch
        const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`, { headers });
        if (!refRes.ok) throw new Error(`Could not fetch main branch ref: ${refRes.statusText}`);
        const refData = await refRes.json();
        const parentCommitSha = refData.object.sha;

        // 2. Get base tree SHA from parent commit
        const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${parentCommitSha}`, { headers });
        if (!commitRes.ok) throw new Error(`Could not fetch parent commit: ${commitRes.statusText}`);
        const commitData = await commitRes.json();
        const baseTreeSha = commitData.tree.sha;

        // 3. Create Blobs for each file
        const treeItems = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const arrayBuffer = await file.blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            let base64 = '';
            const chunkSize = 0x8000; // 32KB chunks
            for (let j = 0; j < uint8Array.length; j += chunkSize) {
                const chunk = uint8Array.subarray(j, j + chunkSize);
                base64 += String.fromCharCode.apply(null, chunk);
            }
            base64 = btoa(base64);

            const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ content: base64, encoding: 'base64' })
            });

            if (!blobRes.ok) {
                console.warn(`Failed blob for ${file.path}, trying direct contents API...`);
                continue;
            }
            const blobData = await blobRes.json();

            treeItems.push({
                path: file.path,
                mode: '100644',
                type: 'blob',
                sha: blobData.sha
            });
        }

        // 4. Create Tree with all files
        const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: treeItems
            })
        });

        if (!treeRes.ok) throw new Error(`Failed to create tree: ${treeRes.statusText}`);
        const treeData = await treeRes.json();

        // 5. Create Single Commit
        const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                message: commitMessage,
                tree: treeData.sha,
                parents: [parentCommitSha]
            })
        });

        if (!newCommitRes.ok) throw new Error(`Failed to create commit: ${newCommitRes.statusText}`);
        const newCommitData = await newCommitRes.json();

        // 6. Update Main Branch Reference
        const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                sha: newCommitData.sha,
                force: false
            })
        });

        if (!updateRefRes.ok) throw new Error(`Failed to update main ref: ${updateRefRes.statusText}`);

        console.log(`✅ SUCCESS: ${files.length} files committed in 1 commit (${newCommitData.sha.substring(0, 7)})`);
        return true;

    } catch (e) {
        console.warn("Git Trees batch API encounter issue, falling back to individual upload:", e);
        for (let i = 0; i < files.length; i++) {
            await uploadFileToGitHub(token, owner, repo, files[i].path, files[i].blob, commitMessage);
        }
        return true;
    }
}

async function uploadFileToGitHub(token, owner, repo, path, blob, message) {
    try {
        const fileSizeMB = blob.size / (1024 * 1024);
        if (fileSizeMB > 100) {
            throw new Error(`File ${path} is too large (${fileSizeMB.toFixed(2)}MB). GitHub limit is 100MB.`);
        }

        let existingSha = null;
        try {
            const getResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (getResponse.ok) {
                const fileData = await getResponse.json();
                existingSha = fileData.sha;
            }
        } catch (e) {}

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let base64 = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, i + chunkSize);
            base64 += String.fromCharCode.apply(null, chunk);
        }
        base64 = btoa(base64);

        const requestBody = {
            message: message,
            content: base64,
            branch: 'main'
        };
        if (existingSha) requestBody.sha = existingSha;

        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        return response.ok;
    } catch (e) {
        console.error(`FAILED: ${path} - ${e.message}`);
        return false;
    }
}

// CONVERTS BOTH BASE64 (data:) AND MEMORY BLOBS (blob:) INTO UPLOADABLE BLOBS
async function dataUrlToBlob(url) {
    if (!url) return null;
    if (url.startsWith('data:') || url.startsWith('blob:')) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                return await res.blob();
            }
        } catch (e) {
            console.warn("dataUrlToBlob fetch failed for:", url, e);
        }
    }
    return null;
}
