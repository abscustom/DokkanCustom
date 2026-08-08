/* ============================================================
   1. GLOBAL STATE & MAPS
   ============================================================ */
let currentClass = "none"; 
let currentRarity = "none";
let currentType = "none"; 
let sIdx = 0; 
let lIdx = 0; 
let selectedForm = null;        
let currentSuperAttack = null;  
let selectedStat = null;
let selectedListItem = null;
let currentActiveSkill = null;
let isSwitchingActive = false;
let currentAwakeningMode = 'none';

// Separate variables for frame and type
const defaultTypeImg = "./images/type_none.png";
const defaultFrameImg = "./images/frame_none.png";

const lightningColors = {
    agl: 'rgb(0, 150, 255)', teq: 'rgb(0, 255, 50)', int: 'rgb(210, 0, 255)', 
    str: 'rgb(255, 0, 0)', phy: 'rgb(255, 230, 0)', none: 'rgba(0,0,0,0)'
};

const typeImageMap = {
    super: { agl: './images/super_type_agl.png', teq: './images/super_type_teq.png', int: './images/super_type_int.png', str: './images/super_type_str.png', phy: './images/super_type_phy.png', none: defaultTypeImg },
    extreme: { agl: './images/extreme_type_agl.png', teq: './images/extreme_type_teq.png', int: './images/extreme_type_int.png', str: './images/extreme_type_str.png', phy: './images/extreme_type_phy.png', none: defaultTypeImg },
    none: { agl: './images/type_agl.png', teq: './images/type_teq.png', int: './images/type_int.png', str: './images/type_str.png', phy: './images/type_phy.png', none: defaultTypeImg }
};
const typeImageUrls = { 'agl': './images/type_agl.png', 'teq': './images/type_teq.png', 'int': './images/type_int.png', 'str': './images/type_str.png', 'phy': './images/type_phy.png', 'none': defaultTypeImg };

const frameMap = { agl: './images/frame_agl.png', teq: './images/frame_teq.png', int: './images/frame_int.png', str: './images/frame_str.png', phy: './images/frame_phy.png', none: defaultFrameImg };
const rarityStats = { LR: { max: 150, sa: 20, cost: 77 }, TUR: { max: 120, sa: 10, cost: 58 }, none: { max: 0, sa: 0, cost: 0 } };

const savedInputs = [
    "descInput", "nameInput", "dateInput", "ezaDateInput", "sezaDateInput", "leaderInput", "imageInput",
    "input-hp-max", "input-atk-max", "input-def-max", "input-passive-name-sidebar",
    "input-active-type", "input-active-name", "input-active-effect", "input-active-condition-title", "input-active-conditions",
    "formNameInput", "formLinkInput", "input-folder-id"
];