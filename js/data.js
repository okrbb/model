// js/data.js

const districtToRegionMap = {
    // Banskobystrický kraj
    " bystrica": "banska-bystrica", "banska bystrica": "banska-bystrica", "b. bystrica": "banska-bystrica", "b.bystrica": "banska-bystrica",
    "brezno": "banska-bystrica", "lučenec": "banska-bystrica", "lucenec": "banska-bystrica", "poltár": "banska-bystrica", "poltar": "banska-bystrica",
    "rimavská sobota": "banska-bystrica", "rimavska sobota": "banska-bystrica", "revúca": "banska-bystrica", "revuca": "banska-bystrica",
    "veľký krtíš": "banska-bystrica", "velky krtis": "banska-bystrica", "zvolen": "banska-bystrica", "detva": "banska-bystrica",
    "krupina": "banska-bystrica", "žiar nad hronom": "banska-bystrica", "ziar nad hronom": "banska-bystrica",
    " štiavnica": "banska-bystrica", "banska stiavnica": "banska-bystrica", "žarnovica": "banska-bystrica", "zarnovica": "banska-bystrica",

    // Bratislavský kraj
    "bratislava i": "bratislavsky", "bratislava ii": "bratislavsky", "bratislava iii": "bratislavsky", "bratislava iv": "bratislavsky", "bratislava v": "bratislavsky",
    "malacky": "bratislavsky", "pezinok": "bratislavsky", "senec": "bratislavsky",

    // Trnavský kraj
    "trnava": "trnava", "hlohovec": "trnava", "dunajská streda": "trnava", "dunajska streda": "trnava",
    "galanta": "trnava", "piešťany": "trnava", "piestany": "trnava", "senica": "trnava", "skalica": "trnava",

    // Trenčiansky kraj
    "trenčín": "trencin", "trencin": "trencin", "ilava": "trencin", "bánovce nad bebravou": "trencin", "banovce nad bebravou": "trencin",
    "nové mesto nad váhom": "trencin", "nove mesto nad vahom": "trencin", "myjava": "trencin", "považská bystrica": "trencin", "povazska bystrica": "trencin",
    "púchov": "trencin", "puchov": "trencin", "prievidza": "trencin", "partizánske": "trencin", "partizanske": "trencin",

    // Nitriansky kraj
    "nitra": "nitra", "zlaté moravce": "nitra", "zlate moravce": "nitra", "komárno": "nitra", "komarno": "nitra",
    "levice": "nitra", "nové zámky": "nitra", "nove zamky": "nitra", "šaľa": "nitra", "sala": "nitra", "topolcany": "nitra", "topolcany": "nitra",

    // Žilinský kraj
    "žilina": "zilina", "zilina": "zilina", "bytča": "zilina", "bytca": "zilina", "kysucké nové mesto": "zilina", "kysucke nove mesto": "zilina",
    "čadca": "zilina", "cadca": "zilina", "dolný kubín": "zilina", "dolny kubin": "zilina", "námestovo": "zilina", "namestovo": "zilina",
    "tvrdošín": "zilina", "tvrdosin": "zilina", "liptovský mikuláš": "zilina", "liptovsky mikulas": "zilina", "martin": "zilina",
    "turčianske teplice": "zilina", "turcianske teplice": "zilina", "ružomberok": "zilina", "ruzomberok": "zilina",

    // Prešovský kraj
    "prešov": "presov", "presov": "presov", "sabinov": "presov", "bardejov": "presov", "humenné": "presov", "humenne": "presov",
    "medzilaborce": "presov", "snina": "presov", "kežmarok": "presov", "kezmarok": "presov", "poprad": "presov", "levoča": "presov", "levoca": "presov",
    "stará lubovna": "presov", "stara lubovna": "presov", "stropkov": "presov", "svidník": "presov", "svidnik": "presov", "vranov nad toplou": "presov", "vranov nad toplou": "presov",

    // Košický kraj
    "košice i": "kosice", "kosice i": "kosice", "košice ii": "kosice", "kosice ii": "kosice",
    "košice iii": "kosice", "kosice iii": "kosice", "košice iv": "kosice", "kosice iv": "kosice",
    "košice-okolie": "kosice", "košice okolie": "kosice", "košice - okolie": "kosice",
    "kosice-okolie": "kosice", "kosice okolie": "kosice", "kosice - okolie": "kosice",
    "michalovce": "kosice", "sobrance": "kosice", "rožňava": "kosice", "roznava": "kosice",
    "spišská nová ves": "kosice", "spisska nova ves": "kosice",
    "gelnica": "kosice", "trebišov": "kosice", "trebisov": "kosice"
};

const regionMeta = {
    "banska-bystrica": { name: "Banskobystrický kraj", seat: " Bystrica", center: [48.7390, 19.1530] },
    "bratislavsky": { name: "Bratislavský kraj", seat: "Bratislava", center: [48.1486, 17.1077] },
    "trnava": { name: "Trnavský kraj", seat: "Trnava", center: [48.3775, 17.5884] },
    "trencin": { name: "Trenčiansky kraj", seat: "Trenčín", center: [48.8945, 18.0441] },
    "nitra": { name: "Nitriansky kraj", seat: "Nitra", center: [48.3061, 18.0878] },
    "zilina": { name: "Žilinský kraj", seat: "Žilina", center: [49.2232, 18.7401] },
    "presov": { name: "Prešovský kraj", seat: "Prešov", center: [49.0018, 21.2393] },
    "kosice": { name: "Košický kraj", seat: "Košice", center: [48.7164, 21.2611] }
};

const districtCoordinates = {
    " Bystrica": [48.7390, 19.1530], "Brezno": [48.8043, 19.6459], "Lučenec": [48.3301, 19.6648],
    "Poltár": [48.4300, 19.7967], "Rimavská Sobota": [48.3824, 20.0121], "Revúca": [48.6835, 20.1171],
    "Veľký Krtíš": [48.2104, 19.3497], "Zvolen": [48.5762, 19.1534], "Detva": [48.5601, 19.4192],
    "Krupina": [48.3524, 19.0648], "Žiar nad Hronom": [48.5915, 18.8488], " Štiavnica": [48.4585, 18.8931],
    "Žarnovica": [48.4831, 18.7154],
    "Bratislava I": [48.1486, 17.1077], "Bratislava II": [48.1400, 17.1500], "Bratislava III": [48.1700, 17.1300],
    "Bratislava IV": [48.1800, 17.0500], "Bratislava V": [48.1100, 17.1100], "Malacky": [48.4362, 17.0218],
    "Pezinok": [48.2862, 17.2684], "Senec": [48.2195, 17.4004],
    "Trnava": [48.3775, 17.5884], "Hlohovec": [48.4284, 17.7997], "Dunajská Streda": [47.9942, 17.6166],
    "Galanta": [48.1901, 17.7282], "Piešťany": [48.5908, 17.8263], "Senica": [48.6792, 17.3669],
    "Skalica": [48.8449, 17.2248],
    "Trenčín": [48.8945, 18.0441], "Ilava": [48.9984, 18.2324], "Bánovce nad Bebravou": [48.7208, 18.2575],
    "Nové Mesto nad Váhom": [48.7562, 17.8304], "Myjava": [48.7523, 17.5678], "Považská Bystrica": [49.1164, 18.4481],
    "Púchov": [49.1249, 18.3262], "Prievidza": [48.7724, 18.6253], "Partizánske": [48.6284, 18.3742],
    "Nitra": [48.3061, 18.0878], "Zlaté Moravce": [48.3848, 18.4004], "Komárno": [47.7636, 18.1281],
    "Levice": [48.2149, 18.6071], "Nové Zámky": [47.9855, 18.1619], "Šaľa": [48.1512, 17.8718],
    "Topoľčany": [48.5615, 18.1748],
    "Žilina": [49.2232, 18.7401], "Bytča": [49.2224, 18.5584], "Kysucké Nové Mesto": [49.3005, 18.7869],
    "Čadca": [49.4381, 18.7897], "Dolný Kubín": [49.2094, 19.2997], "Námestovo": [49.4075, 19.4811],
    "Tvrdošín": [49.3359, 19.5584], "Liptovský Mikuláš": [49.0829, 19.6105], "Martin": [49.0662, 18.9221],
    "Turčianske Teplice": [48.8612, 18.8624], "Ružomberok": [49.0748, 19.3031],
    "Prešov": [49.0018, 21.2393], "Sabinov": [49.1031, 21.0984], "Bardejov": [49.2935, 21.2721],
    "Humenné": [48.9372, 21.9124], "Medzilaborce": [49.2724, 21.9015], "Snina": [48.9884, 22.1524],
    "Kežmarok": [49.1362, 20.4331], "Poprad": [49.0543, 20.3008], "Levoča": [49.0264, 20.5897],
    "Stará Ľubovňa": [49.3015, 20.6897], "Stropkov": [49.2024, 21.6521], "Svidník": [49.3048, 21.5712],
    "Vranov nad Topľou": [48.8884, 21.6841],
    "Košice I": [48.7200, 21.2500], "Košice II": [48.7000, 21.2400], "Košice III": [48.7300, 21.2700],
    "Košice IV": [48.6900, 21.2800], "Košice - okolie": [48.7152, 21.3262], "Michalovce": [48.7548, 21.9197],
    "Sobrance": [48.7449, 22.1824], "Rožňava": [48.6605, 20.5372], "Spišská Nová Ves": [48.9442, 20.5615],
    "Gelnica": [48.8521, 20.9362], "Trebišov": [48.6284, 21.7248]
};

const colorPalette = [
    "#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", 
    "#eab308", "#06b6d4", "#a855f7", "#14b8a6", "#ef4444"
];

const mergedDistrictNameMap = {
    'bratislava ii': 'Bratislava I',
    'bratislava iii': 'Bratislava I',
    'bratislava iv': 'Bratislava I',
    'bratislava v': 'Bratislava I',
    'kosice ii': 'Košice I',
    'kosice iii': 'Košice I',
    'kosice iv': 'Košice I'
};

function normalizeDistrictName(name) {
    if (!name) return "";
    return name.toLowerCase()
               .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
               .trim()
               .replace(/okres\s+/i, '')
               .replace(/\s+okres/i, '')
               .replace(/[^a-z0-9\s-]/g, '')
               .replace(/\s+/g, ' ');
}

function getCanonicalDistrictName(name) {
    if (!name) return "";
    const norm = normalizeDistrictName(name);
    return mergedDistrictNameMap[norm] || name;
}

function getCanonicalDistrictNorm(name) {
    return normalizeDistrictName(getCanonicalDistrictName(name));
}

function getTooltipDistrictName(name) {
    const canonicalName = getCanonicalDistrictName(name);
    if (canonicalName === 'Bratislava I') return 'Bratislava';
    if (canonicalName === 'Košice I') return 'Košice';
    return canonicalName;
}

function isMergedCityDistrict(name) {
    const norm = normalizeDistrictName(name);
    return norm === 'bratislava i' || norm === 'bratislava ii' || norm === 'bratislava iii' || norm === 'bratislava iv' || norm === 'bratislava v'
        || norm === 'kosice i' || norm === 'kosice ii' || norm === 'kosice iii' || norm === 'kosice iv';
}

function getDefaultDistrictData() {
    return {
        "banska-bystrica": {
            " Bystrica": { fte: 14, wpId: null }, "Brezno": { fte: 3, wpId: null }, "Lučenec": { fte: 4, wpId: null },
            "Poltár": { fte: 2, wpId: null }, "Rimavská Sobota": { fte: 5, wpId: null }, "Revúca": { fte: 2, wpId: null },
            "Veľký Krtíš": { fte: 3, wpId: null }, "Zvolen": { fte: 4, wpId: null }, "Detva": { fte: 3, wpId: null },
            "Krupina": { fte: 2, wpId: null }, "Žiar nad Hronom": { fte: 4, wpId: null }, " Štiavnica": { fte: 2, wpId: null },
            "Žarnovica": { fte: 4, wpId: null }
        },
        "bratislavsky": {
            "Bratislava I": { fte: 28, wpId: null }, "Malacky": { fte: 2, wpId: null },
            "Pezinok": { fte: 2, wpId: null }, "Senec": { fte: 2, wpId: null }
        },
        "trnava": {
            "Trnava": { fte: 15, wpId: null }, "Hlohovec": { fte: 3, wpId: null }, "Dunajská Streda": { fte: 5, wpId: null },
            "Galanta": { fte: 5, wpId: null }, "Piešťany": { fte: 5, wpId: null }, "Senica": { fte: 6, wpId: null },
            "Skalica": { fte: 6, wpId: null }
        },
        "trencin": {
            "Trenčín": { fte: 14, wpId: null }, "Ilava": { fte: 2, wpId: null }, "Bánovce nad Bebravou": { fte: 3, wpId: null },
            "Nové Mesto nad Váhom": { fte: 3, wpId: null }, "Myjava": { fte: 2, wpId: null }, "Považská Bystrica": { fte: 4, wpId: null },
            "Púchov": { fte: 2, wpId: null }, "Prievidza": { fte: 5, wpId: null }, "Partizánske": { fte: 5, wpId: null }
        },
        "nitra": {
            "Nitra": { fte: 15, wpId: null }, "Zlaté Moravce": { fte: 2, wpId: null }, "Komárno": { fte: 6, wpId: null },
            "Levice": { fte: 6, wpId: null }, "Nové Zámky": { fte: 8, wpId: null }, "Šaľa": { fte: 3, wpId: null },
            "Topoľčany": { fte: 5, wpId: null }
        },
        "zilina": {
            "Žilina": { fte: 16, wpId: null }, "Bytča": { fte: 2, wpId: null }, "Kysucké Nové Mesto": { fte: 2, wpId: null },
            "Čadca": { fte: 5, wpId: null }, "Dolný Kubín": { fte: 3, wpId: null }, "Námestovo": { fte: 3, wpId: null },
            "Tvrdošín": { fte: 2, wpId: null }, "Liptovský Mikuláš": { fte: 5, wpId: null }, "Martin": { fte: 5, wpId: null },
            "Turčianske Teplice": { fte: 2, wpId: null }, "Ružomberok": { fte: 4, wpId: null }
        },
        "presov": {
            "Prešov": { fte: 17, wpId: null }, "Sabinov": { fte: 2, wpId: null }, "Bardejov": { fte: 4, wpId: null },
            "Humenné": { fte: 5, wpId: null }, "Medzilaborce": { fte: 2, wpId: null }, "Snina": { fte: 3, wpId: null },
            "Kežmarok": { fte: 4, wpId: null }, "Poprad": { fte: 6, wpId: null }, "Levoča": { fte: 2, wpId: null },
            "Stará Ľubovňa": { fte: 4, wpId: null }, "Stropkov": { fte: 3, wpId: null }, "Svidník": { fte: 3, wpId: null },
            "Vranov nad Topľou": { fte: 6, wpId: null }
        },
        "kosice": {
            "Košice I": { fte: 20, wpId: null }, "Košice - okolie": { fte: 8, wpId: null }, "Michalovce": { fte: 6, wpId: null },
            "Sobrance": { fte: 4, wpId: null }, "Rožňava": { fte: 4, wpId: null }, "Spišská Nová Ves": { fte: 5, wpId: null },
            "Gelnica": { fte: 2, wpId: null }, "Trebišov": { fte: 5, wpId: null }
        }
    };
}

function normalizeDistrictDataForModel(sourceDistrictData) {
    const normalized = {};

    Object.entries(sourceDistrictData || {}).forEach(([regionKey, districts]) => {
        normalized[regionKey] = {};

        Object.entries(districts || {}).forEach(([districtName, value]) => {
            const canonicalName = getCanonicalDistrictName(districtName);
            if (!normalized[regionKey][canonicalName]) {
                normalized[regionKey][canonicalName] = {
                    fte: 0,
                    wpId: null
                };
            }

            normalized[regionKey][canonicalName].fte += Number(value?.fte || 0);
            if (value?.wpId) {
                normalized[regionKey][canonicalName].wpId = value.wpId;
            }
        });
    });

    return normalized;
}

function getRegionKeyForDistrict(districtName) {
    const norm = getCanonicalDistrictNorm(districtName);
    return districtToRegionMap[norm] || null;
}

function getRawFeatureDistrictName(feature) {
    if (!feature || !feature.properties) return "";
    const props = feature.properties;
    return props.NM3 || props.NM2 || props.name || props.NAME_2 || props.okres || props.Okres || props.DISTRICT || props.LAU2_NAM || props.TXT || "";
}

function getFeatureDistrictName(feature) {
    return getCanonicalDistrictName(getRawFeatureDistrictName(feature));
}

function getRegionKeyFromFeature(feature) {
    if (!feature || !feature.properties) return null;
    const props = feature.properties;
    const name = props.NM4 || props.name_1 || props.NAME_1 || props.kraj || props.Kraj || props.REGION || props.TXT || "";
    const norm = name.toLowerCase().trim();
    if (norm.includes("bansk")) return "banska-bystrica";
    if (norm.includes("bratislav")) return "bratislavsky";
    if (norm.includes("trnav")) return "trnava";
    if (norm.includes("trenč") || norm.includes("trenci")) return "trencin";
    if (norm.includes("nitr")) return "nitra";
    if (norm.includes("žilin") || norm.includes("zilin")) return "zilina";
    if (norm.includes("prešov") || norm.includes("presov")) return "presov";
    if (norm.includes("košic") || norm.includes("kosic")) return "kosice";
    return null;
}

function getDistrictWorkplaceId(districtName) {
    const rKey = getRegionKeyForDistrict(districtName);
    if (!rKey || !districtData[rKey]) return null;
    for (const key in districtData[rKey]) {
        if (normalizeDistrictName(key) === normalizeDistrictName(districtName)) {
            return districtData[rKey][key].wpId;
        }
    }
    return null;
}

function getDistrictFteValue(districtName) {
    const rKey = getRegionKeyForDistrict(districtName);
    if (!rKey || !districtData[rKey]) return 0;
    for (const key in districtData[rKey]) {
        if (normalizeDistrictName(key) === normalizeDistrictName(districtName)) {
            return districtData[rKey][key].fte;
        }
    }
    return 0;
}

function setDistrictWorkplaceId(districtName, wpId) {
    const rKey = getRegionKeyForDistrict(districtName);
    if (!rKey || !districtData[rKey]) return;
    for (const key in districtData[rKey]) {
        if (normalizeDistrictName(key) === normalizeDistrictName(districtName)) {
            districtData[rKey][key].wpId = wpId;
        }
    }
}

function setDistrictFteValue(districtName, newFte) {
    const rKey = getRegionKeyForDistrict(districtName);
    if (!rKey || !districtData[rKey]) return;
    for (const key in districtData[rKey]) {
        if (normalizeDistrictName(key) === normalizeDistrictName(districtName)) {
            districtData[rKey][key].fte = newFte;
        }
    }
}

function getDistrictMunicipalityCount(districtName) {
    const norm = getCanonicalDistrictNorm(districtName);
    return districtMunicipalityCounts[norm] !== undefined ? districtMunicipalityCounts[norm] : null;
}
