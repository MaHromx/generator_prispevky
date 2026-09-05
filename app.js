const TEMPLATE_INDEX_URL = "templates/index.json";

const state = {
    templates: [],
    currentTemplate: null,
    values: {},
    images: {},
    assets: {}
};

const templateList = document.getElementById("template-list");
const templateSelection = document.getElementById("template-selection");
const editor = document.getElementById("editor");
const formContainer = document.getElementById("form-container");
const templateTitle = document.getElementById("template-title");
const canvas = document.getElementById("preview-canvas");
const downloadButton = document.getElementById("download-button");
const backButton = document.getElementById("back-button");

const ctx = canvas.getContext("2d");

const GLOBAL_DEFAULTS = {
    color: "#014EA1",
    textFontFamily: "Montserrat",
    textFontWeight: 400,
    textFontStyle: "normal",
    textAlign: "left",
    textVerticalAlign: "top",
    textLineHeight: 1.2,
    imageFit: "cover",
    opacity: 1
};

init();


/* =========================================================
   INIT
========================================================= */

async function init() {
    try {
        const response = await fetch(TEMPLATE_INDEX_URL);

        if (!response.ok) {
            throw new Error(
                "Nepodařilo se načíst seznam šablon."
            );
        }

        state.templates = await response.json();

        renderTemplateList();

    } catch (error) {
        console.error(error);

        templateList.innerHTML = `
            <p>Nepodařilo se načíst šablony.</p>
        `;
    }
}


/* =========================================================
   TEMPLATE LIST
========================================================= */

function renderTemplateList() {
    templateList.innerHTML = "";

    if (state.templates.length === 0) {
        templateList.innerHTML = `
            <p>Nejsou dostupné žádné šablony.</p>
        `;

        return;
    }

    state.templates.forEach(template => {
        const card = document.createElement("div");

        card.className = "template-card";

        card.innerHTML = `
            <h3>${escapeHtml(template.name)}</h3>
            <p>${escapeHtml(template.description || "")}</p>
        `;

        card.addEventListener(
            "click",
            () => openTemplate(template.id)
        );

        templateList.appendChild(card);
    });
}


/* =========================================================
   OPEN TEMPLATE
========================================================= */

async function openTemplate(templateId) {
    try {
        const response = await fetch(
            `templates/${encodeURIComponent(templateId)}/template.json`
        );

        if (!response.ok) {
            throw new Error(
                "Šablonu se nepodařilo načíst."
            );
        }

        const template = await response.json();

        state.currentTemplate = template;
        state.values = {};
        state.images = {};
        state.assets = {};

        initializeFieldValues(template);

        canvas.width = template.canvas.width;
        canvas.height = template.canvas.height;

        templateSelection.classList.add("hidden");
        editor.classList.remove("hidden");

        templateTitle.textContent = template.name;

        renderForm();

        await loadTemplateAssets();

        render();

    } catch (error) {
        console.error(error);

        alert("Šablonu se nepodařilo načíst.");
    }
}


/* =========================================================
   FIELD VALUES
========================================================= */

function initializeFieldValues(template) {
    if (!Array.isArray(template.fields)) {
        return;
    }

    template.fields.forEach(field => {

        if (field.default !== undefined) {
            state.values[field.id] = field.default;
            return;
        }

        if (field.type === "checkbox") {
            state.values[field.id] = false;
            return;
        }

        if (field.type === "multiselect") {
            state.values[field.id] = [];
            return;
        }

        state.values[field.id] = "";
    });
}


/* =========================================================
   FORM
========================================================= */

function renderForm() {
    formContainer.innerHTML = "";

    if (!Array.isArray(state.currentTemplate.fields)) {
        updateDownloadState();
        return;
    }

    state.currentTemplate.fields.forEach(field => {
        const wrapper = document.createElement("div");

        wrapper.className = "form-field";
        wrapper.dataset.fieldId = field.id;

        const label = document.createElement("label");

        if (field.type !== "checkbox") {
            label.textContent = field.label || field.id;
            wrapper.appendChild(label);
        }

        const input = createFieldInput(field);

        if (!input) {
            console.warn(
                `Neznámý typ pole: ${field.type}`
            );

            return;
        }

        wrapper.appendChild(input);

        formContainer.appendChild(wrapper);

        connectFieldEvents(
            field,
            input
        );
    });

    updateFieldVisibility();
    updateDownloadState();
}


/* =========================================================
   CREATE FIELD INPUT
========================================================= */

function createFieldInput(field) {
    let input;

    /* TEXT */

    if (field.type === "text") {
        input = document.createElement("input");

        input.type = "text";

        if (field.placeholder) {
            input.placeholder =
                field.placeholder;
        }
    }


    /* TEXTAREA */

    else if (field.type === "textarea") {
        input = document.createElement("textarea");

        if (field.placeholder) {
            input.placeholder =
                field.placeholder;
        }
    }


    /* NUMBER */

    else if (field.type === "number") {
        input = document.createElement("input");

        input.type = "number";

        applyNumberProperties(
            input,
            field
        );
    }


    /* CHECKBOX */

    else if (field.type === "checkbox") {
        const container =
            document.createElement("label");

        container.style.display = "flex";
        container.style.flexDirection = "row";
        container.style.alignItems = "center";
        container.style.gap = "8px";
        container.style.cursor = "pointer";

        input =
            document.createElement("input");

        input.type = "checkbox";

        input.checked =
            Boolean(state.values[field.id]);

        container.appendChild(input);

        const text =
            document.createElement("span");

        text.textContent =
            field.label || field.id;

        container.appendChild(text);

        return container;
    }


    /* RANGE */

    else if (field.type === "range") {
        input = document.createElement("input");

        input.type = "range";

        if (field.min !== undefined) {
            input.min = field.min;
        }

        if (field.max !== undefined) {
            input.max = field.max;
        }

        if (field.step !== undefined) {
            input.step = field.step;
        }

        if (
            field.orientation === "vertical"
        ) {
            input.style.writingMode =
                "vertical-lr";

            input.style.direction =
                "rtl";

            input.style.height =
                field.height || "160px";
        }
    }


    /* COLOR */

    else if (field.type === "color") {
        input = document.createElement("input");

        input.type = "color";
    }


    /* SELECT */

    else if (field.type === "select") {
        input = document.createElement("select");

        if (Array.isArray(field.options)) {
            field.options.forEach(option => {
                const optionElement =
                    document.createElement("option");

                if (
                    typeof option === "string"
                ) {
                    optionElement.value =
                        option;

                    optionElement.textContent =
                        option;
                } else {
                    optionElement.value =
                        option.value;

                    optionElement.textContent =
                        option.label ??
                        option.value;
                }

                input.appendChild(
                    optionElement
                );
            });
        }
    }


    /* MULTISELECT */

    else if (field.type === "multiselect") {
        input = document.createElement("select");

        input.multiple = true;

        if (Array.isArray(field.options)) {
            field.options.forEach(option => {
                const optionElement =
                    document.createElement("option");

                if (
                    typeof option === "string"
                ) {
                    optionElement.value =
                        option;

                    optionElement.textContent =
                        option;
                } else {
                    optionElement.value =
                        option.value;

                    optionElement.textContent =
                        option.label ??
                        option.value;
                }

                input.appendChild(
                    optionElement
                );
            });
        }

        setMultiselectValue(
            input,
            state.values[field.id]
        );
    }


    /* POSITION */

    else if (field.type === "position") {
        return createPositionField(field);
    }


    /* IMAGE */

    else if (field.type === "image") {
        input = document.createElement("input");

        input.type = "file";

        input.accept =
            field.accept || "image/*";
    }


    else {
        return null;
    }


    /* VALUE */

    if (
        field.type !== "image" &&
        field.type !== "checkbox" &&
        field.type !== "multiselect"
    ) {
        let value =
            state.values[field.id];

        if (
            value === "" ||
            value === undefined ||
            value === null
        ) {
            if (
                field.type === "color"
            ) {
                value =
                    field.default ??
                    GLOBAL_DEFAULTS.color;
            }
        }

        if (
            value !== undefined &&
            value !== null
        ) {
            input.value = value;
        }
    }


    return input;
}


/* =========================================================
   NUMBER PROPERTIES
========================================================= */

function applyNumberProperties(
    input,
    field
) {
    if (field.min !== undefined) {
        input.min = field.min;
    }

    if (field.max !== undefined) {
        input.max = field.max;
    }

    if (field.step !== undefined) {
        input.step = field.step;
    }

    if (field.placeholder) {
        input.placeholder =
            field.placeholder;
    }
}


/* =========================================================
   POSITION FIELD
========================================================= */

function createPositionField(field) {
    const container =
        document.createElement("div");

    container.className =
        "position-field";

    container.style.display =
        "grid";

    container.style.gridTemplateColumns =
        "repeat(3, 1fr)";

    container.style.gridTemplateRows =
        "repeat(3, 1fr)";

    container.style.gap = "6px";

    const allPositions = [
        "top-left",
        "top-center",
        "top-right",
        "middle-left",
        "center",
        "middle-right",
        "bottom-left",
        "bottom-center",
        "bottom-right"
    ];

    const options =
        normalizePositionOptions(
            field.options
        );

    allPositions.forEach(position => {
        const option =
            options.find(
                item =>
                    item.value === position
            );

        /*
         * Pokud pozice není v template.json,
         * tlačítko vůbec nevytvoříme.
         */
        if (!option) {
            return;
        }

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "position-button";

        button.dataset.position =
            position;

        button.title =
            option.label || position;

        button.textContent =
            getPositionSymbol(position);

        if (option.disabled) {
            button.disabled = true;
            button.classList.add(
                "position-disabled"
            );
        }

        if (
            state.values[field.id] ===
            position
        ) {
            button.classList.add(
                "position-selected"
            );
        }

        if (!option.disabled) {
            button.addEventListener(
                "click",
                () => {
                    state.values[field.id] =
                        position;

                    container
                        .querySelectorAll(
                            ".position-button"
                        )
                        .forEach(
                            otherButton => {
                                otherButton.classList
                                    .remove(
                                        "position-selected"
                                    );
                            }
                        );

                    button.classList.add(
                        "position-selected"
                    );

                    updateFieldVisibility();
                    updateDownloadState();
                    render();
                }
            );
        }

        container.appendChild(button);
    });

    return container;
}


function normalizePositionOptions(
    options
) {
    if (!Array.isArray(options)) {
        return [];
    }

    return options.map(option => {
        if (typeof option === "string") {
            return {
                value: option,
                disabled: false,
                label: option
            };
        }

        return {
            value: option.value,
            disabled:
                option.disabled === true,
            label:
                option.label ||
                option.value
        };
    });
}


function getPositionSymbol(position) {
    const symbols = {
        "top-left": "↖",
        "top-center": "↑",
        "top-right": "↗",
        "middle-left": "←",
        "center": "●",
        "middle-right": "→",
        "bottom-left": "↙",
        "bottom-center": "↓",
        "bottom-right": "↘"
    };

    return symbols[position] || "●";
}


/* =========================================================
   MULTISELECT
========================================================= */

function setMultiselectValue(
    select,
    values
) {
    const selectedValues =
        Array.isArray(values)
            ? values
            : [];

    Array.from(
        select.options
    ).forEach(option => {
        option.selected =
            selectedValues.includes(
                option.value
            );
    });
}


function getMultiselectValue(select) {
    return Array.from(
        select.selectedOptions
    ).map(option => option.value);
}


/* =========================================================
   FIELD EVENTS
========================================================= */

function connectFieldEvents(
    field,
    input
) {
    if (field.type === "position") {
        return;
    }

    const update = () => {
        if (field.type === "image") {
            handleImageInput(
                field,
                input
            );

            return;
        }

        if (field.type === "checkbox") {
            state.values[field.id] =
                input.querySelector(
                    "input[type='checkbox']"
                )?.checked || false;

        } else if (
            field.type === "multiselect"
        ) {
            state.values[field.id] =
                getMultiselectValue(
                    input
                );

        } else if (
            field.type === "number"
        ) {
            state.values[field.id] =
                input.value === ""
                    ? ""
                    : Number(input.value);

        } else {
            state.values[field.id] =
                input.value;
        }

        updateFieldVisibility();
        updateDownloadState();
        render();
    };

    input.addEventListener(
        "input",
        update
    );

    input.addEventListener(
        "change",
        update
    );
}


/* =========================================================
   FIELD VISIBILITY
========================================================= */

function updateFieldVisibility() {
    if (!state.currentTemplate) {
        return;
    }

    state.currentTemplate.fields.forEach(
        field => {
            const wrapper =
                formContainer.querySelector(
                    `[data-field-id="${field.id}"]`
                );

            if (!wrapper) {
                return;
            }

            const visible =
                evaluateCondition(
                    field.visibleWhen
                );

            wrapper.style.display =
                visible ? "" : "none";
        }
    );
}


/* =========================================================
   CONDITIONS
========================================================= */

function evaluateCondition(condition) {
    if (!condition) {
        return true;
    }

    const actualValue =
        state.values[condition.field];

    if (
        condition.equals !== undefined
    ) {
        return actualValue ===
            condition.equals;
    }

    if (
        condition.notEquals !== undefined
    ) {
        return actualValue !==
            condition.notEquals;
    }

    if (
        Array.isArray(condition.in)
    ) {
        return condition.in.includes(
            actualValue
        );
    }

    if (
        condition.truthy === true
    ) {
        return Boolean(actualValue);
    }

    if (
        condition.falsy === true
    ) {
        return !actualValue;
    }

    return true;
}


/* =========================================================
   IMAGE INPUT
========================================================= */

function handleImageInput(
    field,
    input
) {
    const file = input.files[0];

    if (!file) {
        delete state.images[field.id];

        updateDownloadState();
        render();

        return;
    }

    const image = new Image();

    image.onload = () => {
        state.images[field.id] =
            image;

        updateDownloadState();
        render();
    };

    image.onerror = () => {
        console.error(
            "Nepodařilo se načíst obrázek."
        );
    };

    image.src =
        URL.createObjectURL(file);
}


/* =========================================================
   TEMPLATE ASSETS
========================================================= */

async function loadTemplateAssets() {
    const template =
        state.currentTemplate;

    const promises = [];

    /*
     * DEFAULT BACKGROUND
     */

    if (
        template.background?.default
    ) {
        const defaultSource =
            template.background.default;

        if (
            defaultSource.type ===
            "asset"
        ) {
            promises.push(
                loadAssetImage(
                    defaultSource.src,
                    image => {
                        state.assets
                            .defaultBackground =
                            image;
                    }
                )
            );
        }
    }


    /*
     * ELEMENT ASSETS
     */

    if (
        Array.isArray(template.elements)
    ) {
        template.elements.forEach(
            element => {
                if (!element.src) {
                    return;
                }

                if (
                    element.type !==
                        "logo" &&
                    element.type !==
                        "icon" &&
                    element.type !==
                        "image"
                ) {
                    return;
                }

                const assetKey =
                    getElementAssetKey(
                        element
                    );

                promises.push(
                    loadAssetImage(
                        element.src,
                        image => {
                            state.assets[
                                assetKey
                            ] = image;
                        },
                        getAssetBasePath(
                            element
                        )
                    )
                );
            }
        );
    }

    await Promise.all(
        promises
    );
}


/* =========================================================
   ASSET LOADING
========================================================= */

function loadAssetImage(
    src,
    onLoad,
    basePath
) {
    return new Promise(
        resolve => {
            const image =
                new Image();

            image.onload = () => {
                onLoad(image);
                resolve();
            };

            image.onerror = () => {
                console.error(
                    `Nepodařilo se načíst asset: ${src}`
                );

                resolve();
            };

            image.src =
                buildAssetPath(
                    src,
                    basePath
                );
        }
    );
}


function buildAssetPath(
    src,
    basePath
) {
    if (
        src.startsWith("http://") ||
        src.startsWith("https://") ||
        src.startsWith("/")
    ) {
        return src;
    }

    if (src.startsWith("Images/")) {
        return src;
    }

    if (basePath) {
        return `${basePath}/${src}`;
    }

    return `templates/${encodeURIComponent(
        state.currentTemplate.id
    )}/${src}`;
}


function getAssetBasePath(element) {
    if (
        element.assetPath
    ) {
        return element.assetPath;
    }

    if (
        element.assetFolder
    ) {
        return element.assetFolder;
    }

    return "Images";
}


function getElementAssetKey(element) {
    if (element.id) {
        return `element:${element.id}`;
    }

    return `src:${element.src}`;
}


/* =========================================================
   RENDER
========================================================= */

function render() {
    const template =
        state.currentTemplate;

    if (!template) {
        return;
    }

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    drawCanvasBackground(
        template
    );

    drawElements(
        template
    );
}


/* =========================================================
   BACKGROUND
========================================================= */

function drawCanvasBackground(
    template
) {
    const background =
        template.background;

    if (!background) {
        drawCanvasColor(
            template.canvas
        );

        return;
    }

    /*
     * Základní barva plátna.
     */

    drawCanvasColor(
        template.canvas
    );

    let image = null;

    const backgroundType =
        state.values.backgroundType;

    /*
     * VLASTNÍ OBRÁZEK
     */

    if (
        backgroundType === "custom" &&
        background.sourceField &&
        state.images[
            background.sourceField
        ]
    ) {
        image =
            state.images[
                background.sourceField
            ];
    }

    /*
     * DEFAULTNÍ OBRÁZEK
     */

    if (
        backgroundType !== "custom" &&
        background.default?.type ===
            "asset"
    ) {
        image =
            state.assets
                .defaultBackground;
    }

    /*
     * Pokud není obrázek,
     * nic dalšího nepřidáváme.
     */

    if (!image) {
        return;
    }

    const fit =
        background.fit ||
        "cover";

    drawImageElementWithOptions(
        image,
        {
            box: {
                x: 0,
                y: 0,
                width: canvas.width,
                height: canvas.height
            },

            fit: fit,

            grayscale:
                background.grayscale === true,

            opacity:
                background.opacity !==
                undefined
                    ? background.opacity
                    : undefined,

            border:
                background.border,

            borderRadius:
                background.borderRadius
        }
    );

    /*
     * Overlay existuje pouze tehdy,
     * pokud je definovaný v template.json.
     */

    if (background.overlay) {
        drawFill(
            background.overlay,
            0,
            0,
            canvas.width,
            canvas.height
        );
    }
}


/* =========================================================
   CANVAS COLOR
========================================================= */

function drawCanvasColor(canvasConfig) {
    if (
        !canvasConfig ||
        canvasConfig.background ===
            undefined
    ) {
        return;
    }

    ctx.fillStyle =
        canvasConfig.background;

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );
}


/* =========================================================
   ELEMENTS
========================================================= */

function drawElements(template) {
    if (
        !Array.isArray(
            template.elements
        )
    ) {
        return;
    }

    /*
     * Pořadí v template.json
     * = pořadí vrstev.
     */

    template.elements.forEach(
        element => {

            if (
                element.visibleWhen &&
                !evaluateCondition(
                    element.visibleWhen
                )
            ) {
                return;
            }

            if (
                element.hidden === true
            ) {
                return;
            }

            if (
                element.type === "text"
            ) {
                drawTextElement(
                    element
                );
            }

            else if (
                element.type === "shape"
            ) {
                drawShapeElement(
                    element
                );
            }

            else if (
                element.type === "image"
            ) {
                drawImageElement(
                    element
                );
            }

            else if (
                element.type === "logo"
            ) {
                drawLogoElement(
                    element
                );
            }

            else if (
                element.type === "icon"
            ) {
                drawIconElement(
                    element
                );
            }

            else if (
                element.type === "line"
            ) {
                drawLineElement(
                    element
                );
            }

            else {
                console.warn(
                    `Neznámý element: ${element.type}`
                );
            }
        }
    );
}


/* =========================================================
   ELEMENT POSITION
========================================================= */

function resolveElementBox(
    element
) {
    /*
     * Nový způsob:
     *
     * "box": {
     *     "x": 100,
     *     "y": 100,
     *     "width": 500,
     *     "height": 300
     * }
     */

    if (element.box) {
        const box = {
            x: element.box.x ?? 0,
            y: element.box.y ?? 0,
            width:
                element.box.width ?? 0,
            height:
                element.box.height ?? 0
        };

        return applyPosition(
            element,
            box
        );
    }

    /*
     * Kompatibilita se starými šablonami:
     *
     * "x": 100,
     * "y": 100,
     * "width": 500,
     * "height": 300
     */

    const box = {
        x: element.x ?? 0,
        y: element.y ?? 0,
        width:
            element.width ?? 0,
        height:
            element.height ?? 0
    };

    return applyPosition(
        element,
        box
    );
}


/* =========================================================
   POSITION MAPPING
========================================================= */

function applyPosition(
    element,
    box
) {
    /*
     * Pokud position není definovaná,
     * původní pozice zůstává.
     */

    if (!element.position) {
        return box;
    }

    let fieldId = null;
    let positions = null;

    /*
     * Varianta:
     *
     * "position": {
     *     "field": "logoPosition",
     *     "positions": {...}
     * }
     */

    if (
        typeof element.position ===
            "object"
    ) {
        fieldId =
            element.position.field;

        positions =
            element.position.positions;
    }

    /*
     * Pokud není správně definované
     * mapování, nic neměníme.
     */

    if (
        !fieldId ||
        !positions
    ) {
        return box;
    }

    const selected =
        state.values[fieldId];

    if (
        !selected ||
        !positions[selected]
    ) {
        return box;
    }

    const position =
        positions[selected];

    return {
        x:
            position.x !== undefined
                ? position.x
                : box.x,

        y:
            position.y !== undefined
                ? position.y
                : box.y,

        width:
            position.width !==
            undefined
                ? position.width
                : box.width,

        height:
            position.height !==
            undefined
                ? position.height
                : box.height
    };
}


/* =========================================================
   TEXT
========================================================= */

function drawTextElement(
    element
) {
    const text =
        state.values[element.field];

    if (
        text === undefined ||
        text === null ||
        text === ""
    ) {
        return;
    }

    const box =
        resolveElementBox(
            element
        );

    const font =
        element.font || {};

    let fontSize =
        font.size;

    if (
        fontSize === undefined
    ) {
        console.warn(
            "Textový element nemá definovanou velikost fontu.",
            element
        );

        return;
    }

    const minSize =
        font.minSize !== undefined
            ? font.minSize
            : fontSize;

    const shrinkStep =
        font.shrinkStep !==
        undefined
            ? font.shrinkStep
            : 1;

    const fontFamily =
        font.family ??
        GLOBAL_DEFAULTS.textFontFamily;

    const fontWeight =
        font.weight ??
        GLOBAL_DEFAULTS.textFontWeight;

    const fontStyle =
        font.style ??
        GLOBAL_DEFAULTS.textFontStyle;

    const maxLines =
        element.maxLines !==
        undefined
            ? element.maxLines
            : Infinity;

    let lines = [];

    while (
        fontSize >= minSize
    ) {
        ctx.font =
            buildFont(
                fontStyle,
                fontWeight,
                fontSize,
                fontFamily
            );

        lines =
            wrapText(
                text,
                box.width,
                maxLines,
                element.preserveNewlines !==
                    false,
                element.breakLongWords !==
                    false
            );

        if (
            lines.length <= maxLines
        ) {
            break;
        }

        fontSize -=
            shrinkStep;
    }

    if (
        lines.length > maxLines &&
        Number.isFinite(maxLines)
    ) {
        lines =
            lines.slice(
                0,
                maxLines
            );
    }

    const lineHeight =
        fontSize *
        (
            element.lineHeight ??
            GLOBAL_DEFAULTS.textLineHeight
        );

    const totalHeight =
        lines.length *
        lineHeight;

    let startY;

    const verticalAlign =
        element.verticalAlign ??
        GLOBAL_DEFAULTS.textVerticalAlign;

    if (
        verticalAlign ===
        "center"
    ) {
        startY =
            box.y +
            (
                box.height -
                totalHeight
            ) / 2;
    }

    else if (
        verticalAlign ===
        "bottom"
    ) {
        startY =
            box.y +
            box.height -
            totalHeight;
    }

    else {
        startY =
            box.y;
    }

    ctx.save();

    if (
        element.opacity !==
        undefined
    ) {
        ctx.globalAlpha =
            element.opacity;
    }

    ctx.fillStyle =
        element.color ??
        "#FFFFFF";

    ctx.textAlign =
        element.align ??
        GLOBAL_DEFAULTS.textAlign;

    ctx.textBaseline =
        "top";

    lines.forEach(
        (line, index) => {
            let x =
                box.x;

            if (
                ctx.textAlign ===
                "center"
            ) {
                x +=
                    box.width / 2;
            }

            else if (
                ctx.textAlign ===
                "right"
            ) {
                x +=
                    box.width;
            }

            ctx.fillText(
                line,
                x,
                startY +
                    index *
                    lineHeight
            );
        }
    );

    ctx.restore();
}


/* =========================================================
   FONT
========================================================= */

function buildFont(
    style,
    weight,
    size,
    family
) {
    return [
        style,
        weight,
        `${size}px`,
        family
    ].join(" ");
}


/* =========================================================
   TEXT WRAPPING
========================================================= */

function wrapText(
    text,
    maxWidth,
    maxLines,
    preserveNewlines = true,
    breakLongWords = true
) {
    const paragraphs =
        preserveNewlines
            ? String(text).split("\n")
            : [String(text)];

    const lines = [];

    paragraphs.forEach(
        paragraph => {
            if (
                paragraph === ""
            ) {
                lines.push("");
                return;
            }

            const words =
                paragraph.split(
                    /\s+/
                );

            let currentLine =
                "";

            words.forEach(
                word => {

                    if (
                        breakLongWords &&
                        ctx.measureText(
                            word
                        ).width >
                            maxWidth
                    ) {
                        if (
                            currentLine
                        ) {
                            lines.push(
                                currentLine
                            );

                            currentLine =
                                "";
                        }

                        splitLongWord(
                            word,
                            maxWidth,
                            lines
                        );

                        return;
                    }

                    const testLine =
                        currentLine
                            ? `${currentLine} ${word}`
                            : word;

                    if (
                        ctx.measureText(
                            testLine
                        ).width <=
                        maxWidth
                    ) {
                        currentLine =
                            testLine;
                    }

                    else {
                        if (
                            currentLine
                        ) {
                            lines.push(
                                currentLine
                            );
                        }

                        currentLine =
                            word;
                    }
                }
            );

            if (
                currentLine
            ) {
                lines.push(
                    currentLine
                );
            }
        }
    );

    return lines;
}


function splitLongWord(
    word,
    maxWidth,
    lines
) {
    let current = "";

    for (
        const character of word
    ) {
        const test =
            current +
            character;

        if (
            ctx.measureText(
                test
            ).width <=
            maxWidth
        ) {
            current =
                test;
        }

        else {
            if (
                current
            ) {
                lines.push(
                    current
                );
            }

            current =
                character;
        }
    }

    if (
        current
    ) {
        lines.push(
            current
        );
    }
}


/* =========================================================
   SHAPE
========================================================= */

function drawShapeElement(
    element
) {
    const box =
        resolveElementBox(
            element
        );

    if (
        box.width <= 0 ||
        box.height <= 0
    ) {
        return;
    }

    ctx.save();

    applyElementOpacity(
        element
    );

    drawRoundedPath(
        box.x,
        box.y,
        box.width,
        box.height,
        element.borderRadius
    );

    if (
        element.fill !==
        undefined
    ) {
        ctx.fillStyle =
            createFillStyle(
                element.fill,
                box
            );

        ctx.fill();
    }

    if (
        element.border
    ) {
        drawBorder(
            element.border,
            box
        );
    }

    ctx.restore();
}


/* =========================================================
   IMAGE
========================================================= */

function drawImageElement(
    element
) {
    let image = null;

    /*
     * Uploadované obrázky
     */

    if (
        element.field &&
        state.images[
            element.field
        ]
    ) {
        image =
            state.images[
                element.field
            ];
    }

    /*
     * Centrální / template asset
     */

    if (
        !image &&
        element.src
    ) {
        image =
            state.assets[
                getElementAssetKey(
                    element
                )
            ];
    }

    if (!image) {
        return;
    }

    drawImageElementWithOptions(
        image,
        {
            box:
                resolveElementBox(
                    element
                ),

            fit:
                element.fit ??
                GLOBAL_DEFAULTS.imageFit,

            grayscale:
                element.grayscale ===
                true,

            opacity:
                element.opacity,

            border:
                element.border,

            borderRadius:
                element.borderRadius
        }
    );
}


/* =========================================================
   LOGO
========================================================= */

function drawLogoElement(
    element
) {
    if (!element.src) {
        return;
    }

    const image =
        state.assets[
            getElementAssetKey(
                element
            )
        ];

    if (!image) {
        return;
    }

    drawImageElementWithOptions(
        image,
        {
            box:
                resolveElementBox(
                    element
                ),

            fit:
                element.fit ??
                "contain",

            opacity:
                element.opacity,

            border:
                element.border,

            borderRadius:
                element.borderRadius
        }
    );
}


/* =========================================================
   ICON
========================================================= */

function drawIconElement(
    element
) {
    if (!element.src) {
        return;
    }

    const image =
        state.assets[
            getElementAssetKey(
                element
            )
        ];

    if (!image) {
        return;
    }

    drawImageElementWithOptions(
        image,
        {
            box:
                resolveElementBox(
                    element
                ),

            fit:
                element.fit ??
                "contain",

            opacity:
                element.opacity,

            border:
                element.border,

            borderRadius:
                element.borderRadius
        }
    );
}


/* =========================================================
   IMAGE DRAWING
========================================================= */

function drawImageElementWithOptions(
    image,
    options
) {
    const box =
        options.box;

    if (
        !box ||
        box.width <= 0 ||
        box.height <= 0
    ) {
        return;
    }

    ctx.save();

    if (
        options.opacity !==
        undefined
    ) {
        ctx.globalAlpha =
            options.opacity;
    }

    /*
     * Border radius / clipping
     */

    if (
        options.borderRadius !==
        undefined
    ) {
        drawRoundedPath(
            box.x,
            box.y,
            box.width,
            box.height,
            options.borderRadius
        );

        ctx.clip();
    }

    if (
        options.fit ===
        "contain"
    ) {
        drawImageContain(
            image,
            box.x,
            box.y,
            box.width,
            box.height,
            options.grayscale
        );
    }

    else {
        drawImageCover(
            image,
            box.x,
            box.y,
            box.width,
            box.height,
            options.grayscale
        );
    }

    ctx.restore();

    if (
        options.border
    ) {
        ctx.save();

        drawRoundedPath(
            box.x,
            box.y,
            box.width,
            box.height,
            options.borderRadius
        );

        drawBorder(
            options.border,
            box
        );

        ctx.restore();
    }
}


/* =========================================================
   IMAGE COVER
========================================================= */

function drawImageCover(
    image,
    x,
    y,
    width,
    height,
    grayscale = false
) {
    const imageRatio =
        image.width /
        image.height;

    const targetRatio =
        width /
        height;

    let sourceWidth;
    let sourceHeight;
    let sourceX;
    let sourceY;

    if (
        imageRatio >
        targetRatio
    ) {
        sourceHeight =
            image.height;

        sourceWidth =
            image.height *
            targetRatio;

        sourceX =
            (
                image.width -
                sourceWidth
            ) / 2;

        sourceY = 0;
    }

    else {
        sourceWidth =
            image.width;

        sourceHeight =
            image.width /
            targetRatio;

        sourceX = 0;

        sourceY =
            (
                image.height -
                sourceHeight
            ) / 2;
    }

    ctx.save();

    if (
        grayscale
    ) {
        ctx.filter =
            "grayscale(100%)";
    }

    ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        x,
        y,
        width,
        height
    );

    ctx.restore();
}


/* =========================================================
   IMAGE CONTAIN
========================================================= */

function drawImageContain(
    image,
    x,
    y,
    width,
    height,
    grayscale = false
) {
    const imageRatio =
        image.width /
        image.height;

    const targetRatio =
        width /
        height;

    let drawWidth;
    let drawHeight;

    if (
        imageRatio >
        targetRatio
    ) {
        drawWidth =
            width;

        drawHeight =
            width /
            imageRatio;
    }

    else {
        drawHeight =
            height;

        drawWidth =
            height *
            imageRatio;
    }

    const drawX =
        x +
        (
            width -
            drawWidth
        ) / 2;

    const drawY =
        y +
        (
            height -
            drawHeight
        ) / 2;

    ctx.save();

    if (
        grayscale
    ) {
        ctx.filter =
            "grayscale(100%)";
    }

    ctx.drawImage(
        image,
        drawX,
        drawY,
        drawWidth,
        drawHeight
    );

    ctx.restore();
}


/* =========================================================
   BORDER
========================================================= */

function drawBorder(
    border,
    box
) {
    if (
        typeof border ===
        "string"
    ) {
        ctx.strokeStyle =
            border;

        ctx.lineWidth = 1;

        ctx.stroke();

        return;
    }

    if (
        typeof border !==
        "object"
    ) {
        return;
    }

    if (
        border.color !==
        undefined
    ) {
        ctx.strokeStyle =
            border.color;
    }

    if (
        border.width !==
        undefined
    ) {
        ctx.lineWidth =
            border.width;
    }

    ctx.stroke();
}


/* =========================================================
   LINE
========================================================= */

function drawLineElement(
    element
) {
    if (
        element.x1 ===
            undefined ||
        element.y1 ===
            undefined ||
        element.x2 ===
            undefined ||
        element.y2 ===
            undefined
    ) {
        return;
    }

    ctx.save();

    if (
        element.opacity !==
        undefined
    ) {
        ctx.globalAlpha =
            element.opacity;
    }

    ctx.beginPath();

    ctx.moveTo(
        element.x1,
        element.y1
    );

    ctx.lineTo(
        element.x2,
        element.y2
    );

    ctx.strokeStyle =
        element.color ??
        "#FFFFFF";

    ctx.lineWidth =
        element.width ??
        1;

    if (
        element.lineCap !==
        undefined
    ) {
        ctx.lineCap =
            element.lineCap;
    }

    ctx.stroke();

    ctx.restore();
}


/* =========================================================
   ROUNDED RECTANGLE
========================================================= */

function drawRoundedPath(
    x,
    y,
    width,
    height,
    radius
) {
    if (
        radius === undefined
    ) {
        ctx.beginPath();

        ctx.rect(
            x,
            y,
            width,
            height
        );

        return;
    }

    const maxRadius =
        Math.min(
            width / 2,
            height / 2
        );

    const r =
        Math.max(
            0,
            Math.min(
                radius,
                maxRadius
            )
        );

    ctx.beginPath();

    ctx.moveTo(
        x + r,
        y
    );

    ctx.lineTo(
        x + width - r,
        y
    );

    ctx.quadraticCurveTo(
        x + width,
        y,
        x + width,
        y + r
    );

    ctx.lineTo(
        x + width,
        y + height - r
    );

    ctx.quadraticCurveTo(
        x + width,
        y + height,
        x + width - r,
        y + height
    );

    ctx.lineTo(
        x + r,
        y + height
    );

    ctx.quadraticCurveTo(
        x,
        y + height,
        x,
        y + height - r
    );

    ctx.lineTo(
        x,
        y + r
    );

    ctx.quadraticCurveTo(
        x,
        y,
        x + r,
        y

    );

    ctx.closePath();
}


/* =========================================================
   FILL / GRADIENT
========================================================= */

function drawFill(
    fill,
    x,
    y,
    width,
    height
) {
    ctx.save();

    const style =
        createFillStyle(
            fill,
            {
                x,
                y,
                width,
                height
            }
        );

    ctx.fillStyle =
        style;

    ctx.fillRect(
        x,
        y,
        width,
        height
    );

    ctx.restore();
}


function createFillStyle(
    fill,
    box
) {
    /*
     * Jednobarevná výplň
     */

    if (
        typeof fill ===
        "string"
    ) {
        return fill;
    }

    if (
        !fill ||
        typeof fill !==
            "object"
    ) {
        return "#FFFFFF";
    }

    /*
     * LINEAR GRADIENT
     */

    if (
        fill.type ===
        "linear-gradient"
    ) {
        const angle =
            fill.angle ??
            0;

        const radians =
            (
                angle -
                90
            ) *
            Math.PI /
            180;

        const centerX =
            box.x +
            box.width / 2;

        const centerY =
            box.y +
            box.height / 2;

        const length =
            Math.sqrt(
                box.width *
                    box.width +
                box.height *
                    box.height
            ) / 2;

        const x1 =
            centerX -
            Math.cos(radians) *
                length;

        const y1 =
            centerY -
            Math.sin(radians) *
                length;

        const x2 =
            centerX +
            Math.cos(radians) *
                length;

        const y2 =
            centerY +
            Math.sin(radians) *
                length;

        const gradient =
            ctx.createLinearGradient(
                x1,
                y1,
                x2,
                y2
            );

        addGradientColors(
            gradient,
            fill.colors
        );

        return gradient;
    }

    /*
     * RADIAL GRADIENT
     */

    if (
        fill.type ===
        "radial-gradient"
    ) {
        const centerX =
            box.x +
            box.width / 2;

        const centerY =
            box.y +
            box.height / 2;

        const radius =
            Math.max(
                box.width,
                box.height
            ) / 2;

        const gradient =
            ctx.createRadialGradient(
                centerX,
                centerY,
                0,
                centerX,
                centerY,
                radius
            );

        addGradientColors(
            gradient,
            fill.colors
        );

        return gradient;
    }

    /*
     * Pokud je objekt s color,
     * použijeme color.
     */

    if (
        fill.color !==
        undefined
    ) {
        return fill.color;
    }

    return "#FFFFFF";
}


function addGradientColors(
    gradient,
    colors
) {
    if (
        !Array.isArray(colors) ||
        colors.length === 0
    ) {
        return;
    }

    if (
        colors.length === 1
    ) {
        gradient.addColorStop(
            0,
            colors[0]
        );

        gradient.addColorStop(
            1,
            colors[0]
        );

        return;
    }

    colors.forEach(
        (color, index) => {
            gradient.addColorStop(
                index /
                    (colors.length - 1),
                color
            );
        }
    );
}


/* =========================================================
   OPACITY
========================================================= */

function applyElementOpacity(
    element
) {
    if (
        element.opacity !==
        undefined
    ) {
        ctx.globalAlpha =
            element.opacity;
    }
}


/* =========================================================
   DOWNLOAD VALIDATION
========================================================= */

function updateDownloadState() {
    if (
        !state.currentTemplate
    ) {
        downloadButton.disabled =
            true;

        return;
    }

    const valid =
        validateFields();

    downloadButton.disabled =
        !valid;
}


function validateFields() {
    const fields =
        state.currentTemplate.fields ||
        [];

    for (
        const field of fields
    ) {
        /*
         * Povinné pole musí být viditelné.
         */

        if (
            field.visibleWhen &&
            !evaluateCondition(
                field.visibleWhen
            )
        ) {
            continue;
        }

        /*
         * Běžné required
         */

        if (
            field.required &&
            !hasFieldValue(
                field
            )
        ) {
            return false;
        }

        /*
         * requiredWhen
         */

        if (
            field.requiredWhen &&
            evaluateCondition(
                field.requiredWhen
            )
        ) {
            if (
                field.type ===
                "image"
            ) {
                if (
                    !state.images[
                        field.id
                    ]
                ) {
                    return false;
                }
            }

            else if (
                !hasFieldValue(
                    field
                )
            ) {
                return false;
            }
        }
    }

    return true;
}


function hasFieldValue(
    field
) {
    const value =
        state.values[field.id];

    if (
        field.type ===
        "checkbox"
    ) {
        return value === true;
    }

    if (
        field.type ===
        "multiselect"
    ) {
        return (
            Array.isArray(value) &&
            value.length > 0
        );
    }

    return (
        value !== undefined &&
        value !== null &&
        value !== ""
    );
}


/* =========================================================
   DOWNLOAD
========================================================= */

downloadButton.addEventListener(
    "click",
    () => {
        if (
            !validateFields()
        ) {
            return;
        }

        canvas.toBlob(
            blob => {
                if (!blob) {
                    return;
                }

                const url =
                    URL.createObjectURL(
                        blob
                    );

                const link =
                    document.createElement(
                        "a"
                    );

                link.href = url;

                link.download =
                    `${state.currentTemplate.id}.png`;

                link.click();

                URL.revokeObjectURL(
                    url
                );
            },
            "image/png"
        );
    }
);


/* =========================================================
   BACK
========================================================= */

backButton.addEventListener(
    "click",
    () => {
        state.currentTemplate =
            null;

        state.values = {};
        state.images = {};
        state.assets = {};

        editor.classList.add(
            "hidden"
        );

        templateSelection.classList.remove(
            "hidden"
        );

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );
    }
);


/* =========================================================
   HELPERS
========================================================= */

function hexToRgba(
    hex,
    opacity
) {
    if (
        typeof hex !==
            "string"
    ) {
        return hex;
    }

    const clean =
        hex.replace(
            "#",
            ""
        );

    if (
        clean.length !== 6
    ) {
        return hex;
    }

    const r =
        parseInt(
            clean.substring(
                0,
                2
            ),
            16
        );

    const g =
        parseInt(
            clean.substring(
                2,
                4
            ),
            16
        );

    const b =
        parseInt(
            clean.substring(
                4,
                6
            ),
            16
        );

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}


function escapeHtml(
    value
) {
    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}
