const TEMPLATE_INDEX_URL = "templates/index.json";

const state = {
    templates: [],
    currentTemplate: null,
    values: {},
    images: {},
    assets: {},

    /* POST 3 */
    pages: [],
    currentPage: 0,
    richTextHistory: {},
    richTextHistoryIndex: {}
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
        state.pages = [];
        state.currentPage = 0;
        state.richTextHistory = {};
        state.richTextHistoryIndex = {};

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
   TEMPLATE TYPE
========================================================= */

function isPost3Template(template = state.currentTemplate) {
    return Boolean(
        template &&
        template.pages &&
        template.pages.first &&
        template.pages.content
    );
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

        if (field.type === "richtext") {
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

        if (field.type !== "checkbox" && field.type !== "richtext") {
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


    /* RICH TEXT */

    else if (field.type === "richtext") {
        return createRichTextField(field);
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
   RICH TEXT EDITOR
========================================================= */

function createRichTextField(field) {
    const wrapper =
        document.createElement("div");

    wrapper.className =
        "richtext-editor";

    const toolbar =
        document.createElement("div");

    toolbar.className =
        "richtext-toolbar";

    const editorElement =
        document.createElement("div");

    editorElement.className =
        "richtext-content";

    editorElement.contentEditable =
        "true";

    editorElement.spellcheck =
        true;

    if (field.placeholder) {
        editorElement.dataset.placeholder =
            field.placeholder;
    }

    const buttons = [];

    if (
        field.formatting?.bold !== false
    ) {
        const boldButton =
            createRichTextButton(
                "B",
                "Tučně",
                () => {
                    focusRichTextEditor(
                        editorElement
                    );

                    document.execCommand(
                        "bold",
                        false,
                        null
                    );

                    saveRichTextEditorState(
                        field,
                        editorElement
                    );

                    render();
                }
            );

        boldButton.classList.add(
            "richtext-bold"
        );

        buttons.push(
            boldButton
        );
    }

    if (
        field.formatting?.italic !== false
    ) {
        const italicButton =
            createRichTextButton(
                "I",
                "Kurzíva",
                () => {
                    focusRichTextEditor(
                        editorElement
                    );

                    document.execCommand(
                        "italic",
                        false,
                        null
                    );

                    saveRichTextEditorState(
                        field,
                        editorElement
                    );

                    render();
                }
            );

        italicButton.classList.add(
            "richtext-italic"
        );

        buttons.push(
            italicButton
        );
    }

    if (
        field.formatting?.undo !== false
    ) {
        buttons.push(
            createRichTextButton(
                "↶",
                "Zpět",
                () => {
                    focusRichTextEditor(
                        editorElement
                    );

                    document.execCommand(
                        "undo",
                        false,
                        null
                    );

                    saveRichTextEditorState(
                        field,
                        editorElement
                    );

                    render();
                }
            )
        );
    }

    if (
        field.formatting?.redo !== false
    ) {
        buttons.push(
            createRichTextButton(
                "↷",
                "Znovu",
                () => {
                    focusRichTextEditor(
                        editorElement
                    );

                    document.execCommand(
                        "redo",
                        false,
                        null
                    );

                    saveRichTextEditorState(
                        field,
                        editorElement
                    );

                    render();
                }
            )
        );
    }

    buttons.forEach(
        button =>
            toolbar.appendChild(
                button
            )
    );

    wrapper.appendChild(
        toolbar
    );

    wrapper.appendChild(
        editorElement
    );

    const segments =
        Array.isArray(
            state.values[field.id]
        )
            ? state.values[field.id]
            : [];

    renderSegmentsIntoRichTextEditor(
        editorElement,
        segments
    );

    setupRichTextKeyboard(
        field,
        editorElement
    );

    return wrapper;
}


function createRichTextButton(
    text,
    title,
    handler
) {
    const button =
        document.createElement("button");

    button.type =
        "button";

    button.textContent =
        text;

    button.title =
        title;

    button.className =
        "richtext-button";

    button.addEventListener(
        "mousedown",
        event => {
            event.preventDefault();
        }
    );

    button.addEventListener(
        "click",
        handler
    );

    return button;
}


function focusRichTextEditor(editorElement) {
    editorElement.focus();
}


function setupRichTextKeyboard(
    field,
    editorElement
) {
    editorElement.addEventListener(
        "keydown",
        event => {

            if (
                (event.ctrlKey ||
                    event.metaKey) &&
                event.key.toLowerCase() === "b"
            ) {
                event.preventDefault();

                document.execCommand(
                    "bold",
                    false,
                    null
                );

                saveRichTextEditorState(
                    field,
                    editorElement
                );

                render();

                return;
            }

            if (
                (event.ctrlKey ||
                    event.metaKey) &&
                event.key.toLowerCase() === "i"
            ) {
                event.preventDefault();

                document.execCommand(
                    "italic",
                    false,
                    null
                );

                saveRichTextEditorState(
                    field,
                    editorElement
                );

                render();
            }
        }
    );

    editorElement.addEventListener(
        "input",
        () => {
            saveRichTextEditorState(
                field,
                editorElement
            );

            updateDownloadState();
            render();
        }
    );

    editorElement.addEventListener(
        "paste",
        event => {
            event.preventDefault();

            const text =
                event.clipboardData
                    ?.getData("text/plain") || "";

            document.execCommand(
                "insertText",
                false,
                text
            );

            saveRichTextEditorState(
                field,
                editorElement
            );

            updateDownloadState();
            render();
        }
    );
}


function saveRichTextEditorState(
    field,
    editorElement
) {
    state.values[field.id] =
        richTextDomToSegments(
            editorElement
        );
}


function richTextDomToSegments(
    editorElement
) {
    const segments = [];

    function addSegment(
        text,
        bold,
        italic
    ) {
        if (!text) {
            return;
        }

        const previous =
            segments[
                segments.length - 1
            ];

        if (
            previous &&
            previous.bold === bold &&
            previous.italic === italic
        ) {
            previous.text += text;
            return;
        }

        segments.push({
            text,
            bold,
            italic
        });
    }

    function walk(
        node,
        bold = false,
        italic = false
    ) {
        if (
            node.nodeType ===
            Node.TEXT_NODE
        ) {
            addSegment(
                node.nodeValue,
                bold,
                italic
            );

            return;
        }

        if (
            node.nodeType !==
            Node.ELEMENT_NODE
        ) {
            return;
        }

        const tag =
            node.tagName.toLowerCase();

        if (
            tag === "br"
        ) {
            addSegment(
                "\n",
                bold,
                italic
            );

            return;
        }

        const nextBold =
            bold ||
            tag === "b" ||
            tag === "strong";

        const nextItalic =
            italic ||
            tag === "i" ||
            tag === "em";

        Array.from(
            node.childNodes
        ).forEach(
            child =>
                walk(
                    child,
                    nextBold,
                    nextItalic
                )
        );

        if (
            tag === "div" ||
            tag === "p"
        ) {
            addSegment(
                "\n",
                bold,
                italic
            );
        }
    }

    Array.from(
        editorElement.childNodes
    ).forEach(
        node =>
            walk(node)
    );

    return normalizeRichTextSegments(
        segments
    );
}


function normalizeRichTextSegments(
    segments
) {
    if (!Array.isArray(segments)) {
        return [];
    }

    const result = [];

    segments.forEach(
        segment => {
            if (
                !segment ||
                typeof segment.text !==
                    "string"
            ) {
                return;
            }

            const normalized = {
                text: segment.text,
                bold: Boolean(
                    segment.bold
                ),
                italic: Boolean(
                    segment.italic
                )
            };

            const previous =
                result[
                    result.length - 1
                ];

            if (
                previous &&
                previous.bold ===
                    normalized.bold &&
                previous.italic ===
                    normalized.italic
            ) {
                previous.text +=
                    normalized.text;
            } else {
                result.push(
                    normalized
                );
            }
        }
    );

    return result;
}


function renderSegmentsIntoRichTextEditor(
    editorElement,
    segments
) {
    editorElement.innerHTML = "";

    if (
        !Array.isArray(segments) ||
        segments.length === 0
    ) {
        return;
    }

    segments.forEach(
        segment => {
            const parts =
                String(
                    segment.text || ""
                ).split("\n");

            parts.forEach(
                (
                    part,
                    index
                ) => {
                    if (part) {
                        const span =
                            document.createElement(
                                "span"
                            );

                        span.textContent =
                            part;

                        span.style.fontWeight =
                            segment.bold
                                ? "700"
                                : "400";

                        span.style.fontStyle =
                            segment.italic
                                ? "italic"
                                : "normal";

                        editorElement.appendChild(
                            span
                        );
                    }

                    if (
                        index <
                        parts.length - 1
                    ) {
                        editorElement.appendChild(
                            document.createElement(
                                "br"
                            )
                        );
                    }
                }
            );
        }
    );
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
    if (
        field.type === "position" ||
        field.type === "richtext"
    ) {
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
     * POST 3
     */

    if (isPost3Template(template)) {
        await loadPost3Assets();
        return;
    }


    /*
     * STANDARD TEMPLATE
     */

    if (
        template.background &&
        template.background.default
    ) {
        const defaultSource =
            template.background.default;

        if (
            defaultSource.type ===
                "asset" &&
            defaultSource.src
        ) {
            const defaultBasePath =
                defaultSource.assetPath ||
                defaultSource.assetFolder ||
                null;

            promises.push(
                loadAssetImage(
                    defaultSource.src,
                    image => {
                        state.assets
                            .defaultBackground =
                            image;
                    },
                    defaultBasePath,
                    "defaultBackground"
                )
            );
        }
    }

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
                        ),
                        assetKey
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
   POST 3 ASSETS
========================================================= */

async function loadPost3Assets() {
    const template =
        state.currentTemplate;

    const promises = [];

    const firstBackground =
        template.pages?.first?.background;

    const contentBackground =
        template.pages?.content?.background;

    const backgrounds = [
        firstBackground,
        contentBackground
    ];

    backgrounds.forEach(
        (
            background,
            index
        ) => {
            if (
                !background ||
                !background.default ||
                background.default.type !==
                    "asset" ||
                !background.default.src
            ) {
                return;
            }

            const key =
                index === 0
                    ? "post3:firstBackground"
                    : "post3:contentBackground";

            const basePath =
                background.default.assetPath ||
                background.default.assetFolder ||
                null;

            promises.push(
                loadAssetImage(
                    background.default.src,
                    image => {
                        state.assets[key] =
                            image;
                    },
                    basePath,
                    key
                )
            );
        }
    );

    /*
     * POST 3 používá dvě možné varianty loga.
     * Načteme obě bez ohledu na aktuální výběr,
     * aby změna varianty nemusela znovu načítat asset.
     */

    const logoBasePath =
        findPost3LogoBasePath();

    promises.push(
        loadAssetImage(
            "logo-blue.svg",
            image => {
                state.assets[
                    "post3:logo-blue"
                ] = image;
            },
            logoBasePath,
            "post3:logo-blue"
        )
    );

    promises.push(
        loadAssetImage(
            "logo-white-original.svg",
            image => {
                state.assets[
                    "post3:logo-white"
                ] = image;
            },
            logoBasePath,
            "post3:logo-white"
        )
    );

    /*
     * Fallback pro původní logo,
     * pokud by projekt stále používal logo-white.svg.
     */

    promises.push(
        loadAssetImage(
            "logo-white.svg",
            image => {
                state.assets[
                    "post3:logo-white-fallback"
                ] = image;
            },
            logoBasePath,
            "post3:logo-white-fallback"
        )
    );

    await Promise.all(
        promises
    );
}


function findPost3LogoBasePath() {
    const elements = [
        ...(state.currentTemplate.pages?.first?.elements || []),
        ...(state.currentTemplate.pages?.content?.elements || [])
    ];

    const logo =
        elements.find(
            element =>
                element.type === "logo" &&
                (
                    element.assetPath ||
                    element.assetFolder
                )
        );

    return logo
        ? getAssetBasePath(logo)
        : null;
}


/* =========================================================
   ASSET LOADING
========================================================= */

function loadAssetImage(
    src,
    onLoad,
    basePath,
    debugName
) {
    return new Promise(
        resolve => {
            if (
                !src ||
                typeof src !== "string"
            ) {
                console.error(
                    "Asset nemá platnou cestu:",
                    src
                );

                resolve();
                return;
            }

            const assetUrl =
                buildAssetPath(
                    src,
                    basePath
                );

            console.log(
                `[Asset] Načítám ${debugName || src}:`,
                assetUrl
            );

            const image =
                new Image();

            image.onload = () => {
                console.log(
                    `[Asset] ÚSPĚŠNĚ načteno ${debugName || src}:`,
                    assetUrl,
                    `${image.width}x${image.height}`
                );

                onLoad(image);
                resolve();
            };

            image.onerror = () => {
                console.error(
                    `[Asset] CHYBA při načítání ${debugName || src}:`,
                    assetUrl
                );

                resolve();
            };

            image.src =
                assetUrl;
        }
    );
}


/* =========================================================
   ASSET PATH
========================================================= */

function buildAssetPath(
    src,
    basePath
) {
    if (
        !src ||
        typeof src !== "string"
    ) {
        return "";
    }

    const cleanSrc =
        src.trim();

    if (
        cleanSrc.startsWith("http://") ||
        cleanSrc.startsWith("https://") ||
        cleanSrc.startsWith("data:") ||
        cleanSrc.startsWith("blob:")
    ) {
        return cleanSrc;
    }

    if (
        cleanSrc.startsWith("/")
    ) {
        return cleanSrc;
    }

    if (basePath) {
        const normalizedBasePath =
            String(basePath)
                .replace(/\/+$/, "");

        return new URL(
            `${normalizedBasePath}/${cleanSrc}`,
            document.baseURI
        ).href;
    }

    if (
        !state.currentTemplate ||
        !state.currentTemplate.id
    ) {
        console.error(
            "Nelze vytvořit cestu k assetu: není vybraná šablona."
        );

        return "";
    }

    return new URL(
        `templates/${encodeURIComponent(
            state.currentTemplate.id
        )}/${cleanSrc}`,
        document.baseURI
    ).href;
}


/* =========================================================
   ASSET BASE PATH
========================================================= */

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

    return null;
}


/* =========================================================
   ELEMENT ASSET KEY
========================================================= */

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

    if (isPost3Template(template)) {
        renderPost3();
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
   POST 3 RENDER
========================================================= */

function renderPost3() {
    const template =
        state.currentTemplate;

    state.pages =
        buildPost3Pages();

    if (
        state.pages.length === 0
    ) {
        state.pages = [
            {
                type: "first"
            }
        ];
    }

    if (
        state.currentPage >=
        state.pages.length
    ) {
        state.currentPage =
            state.pages.length - 1;
    }

    canvas.width =
        template.canvas.width;

    canvas.height =
        template.canvas.height;

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const page =
        state.pages[
            state.currentPage
        ];

    if (
        page.type === "first"
    ) {
        drawPost3FirstPage(
            template
        );
    } else {
        drawPost3ContentPage(
            template,
            page
        );
    }

    updatePost3PreviewControls();
}


/* =========================================================
   POST 3 PAGE BUILDING
========================================================= */

function buildPost3Pages() {
    const template =
        state.currentTemplate;

    const pages = [
        {
            type: "first"
        }
    ];

    const segments =
        normalizeRichTextSegments(
            state.values.body
        );

    if (
        segments.length === 0
    ) {
        return pages;
    }

    const contentConfig =
        template.pages.content;

    const textBox =
        contentConfig.textBox;

    const baseFont =
        Number(
            contentConfig.font?.size ??
            25
        );

    const minFont =
        Number(
            contentConfig.font?.minSize ??
            18
        );

    const shrinkStep =
        Number(
            contentConfig.font?.shrinkStep ??
            1
        );

    const initialPages =
        paginateRichText(
            segments,
            textBox,
            contentConfig,
            baseFont
        );

    let optimizedPages =
        initialPages.map(
            page => ({
                ...page,
                segments:
                    cloneSegments(
                        page.segments
                    )
            })
        );

    /*
     * Pokud poslední stránka obsahuje
     * maximálně 3 řádky, pokusíme se
     * všechny tyto řádky vrátit
     * na předchozí stránku.
     */

    if (
        optimizedPages.length >= 2
    ) {
        const lastIndex =
            optimizedPages.length - 1;

        const lastPage =
            optimizedPages[lastIndex];

        if (
            lastPage.lines.length <= 3
        ) {
            const previousPage =
                optimizedPages[
                    lastIndex - 1
                ];

            const combinedSegments =
                combineSegments(
                    previousPage.segments,
                    lastPage.segments
                );

            const optimizedPrevious =
                findLargestFontThatFits(
                    combinedSegments,
                    textBox,
                    contentConfig,
                    baseFont,
                    minFont,
                    shrinkStep
                );

            if (
                optimizedPrevious
            ) {
                optimizedPages =
                    optimizedPages.slice(
                        0,
                        lastIndex - 1
                    ).concat([
                        optimizedPrevious
                    ]);
            }
        }
    }

    optimizedPages.forEach(
        page => {
            pages.push({
                type: "content",
                segments:
                    page.segments,
                lines:
                    page.lines,
                fontSize:
                    page.fontSize,
                lineHeight:
                    page.lineHeight
            });
        }
    );

    return pages;
}


/* =========================================================
   RICH TEXT PAGINATION
========================================================= */

function paginateRichText(
    segments,
    textBox,
    contentConfig,
    fontSize
) {
    const lines =
        layoutRichTextLines(
            segments,
            textBox.width,
            contentConfig,
            fontSize
        );

    const lineHeight =
        calculateRichTextLineHeight(
            contentConfig,
            fontSize
        );

    const maxLines =
        Math.max(
            1,
            Math.floor(
                textBox.height /
                lineHeight
            )
        );

    const pages = [];

    let currentLines = [];

    lines.forEach(
        line => {
            if (
                currentLines.length >=
                maxLines
            ) {
                pages.push(
                    createRichPageFromLines(
                        currentLines,
                        fontSize,
                        lineHeight
                    )
                );

                currentLines = [];
            }

            currentLines.push(
                line
            );
        }
    );

    if (
        currentLines.length > 0
    ) {
        pages.push(
            createRichPageFromLines(
                currentLines,
                fontSize,
                lineHeight
            )
        );
    }

    return pages;
}


function createRichPageFromLines(
    lines,
    fontSize,
    lineHeight
) {
    return {
        lines,
        segments:
            linesToSegments(
                lines
            ),
        fontSize,
        lineHeight
    };
}


/* =========================================================
   LAST PAGE OPTIMIZATION
========================================================= */

function findLargestFontThatFits(
    segments,
    textBox,
    contentConfig,
    startFontSize,
    minFontSize,
    shrinkStep
) {
    let fontSize =
        startFontSize;

    while (
        fontSize >= minFontSize
    ) {
        const lines =
            layoutRichTextLines(
                segments,
                textBox.width,
                contentConfig,
                fontSize
            );

        const lineHeight =
            calculateRichTextLineHeight(
                contentConfig,
                fontSize
            );

        const totalHeight =
            lines.length *
            lineHeight;

        if (
            totalHeight <=
            textBox.height
        ) {
            return {
                lines,
                segments:
                    linesToSegments(
                        lines
                    ),
                fontSize,
                lineHeight
            };
        }

        fontSize -=
            shrinkStep;
    }

    return null;
}


/* =========================================================
   RICH TEXT LINE LAYOUT
========================================================= */

function layoutRichTextLines(
    segments,
    maxWidth,
    contentConfig,
    fontSize
) {
    const lines = [];

    let currentLine = [];

    function pushCurrentLine() {
        if (
            currentLine.length === 0
        ) {
            lines.push({
                runs: [],
                height: calculateRichTextLineHeight(
                    contentConfig,
                    fontSize
                )
            });

            return;
        }

        lines.push({
            runs:
                mergeRichRuns(
                    currentLine
                ),
            height:
                calculateRichTextLineHeight(
                    contentConfig,
                    fontSize
                )
        });

        currentLine = [];
    }

    function currentWidth() {
        return currentLine.reduce(
            (
                total,
                run
            ) => {
                ctx.font =
                    buildRichTextFont(
                        run,
                        fontSize,
                        contentConfig.font
                    );

                return (
                    total +
                    ctx.measureText(
                        run.text
                    ).width
                );
            },
            0
        );
    }

    segments.forEach(
        segment => {
            const text =
                String(
                    segment.text || ""
                );

            const parts =
                text.split("\n");

            parts.forEach(
                (
                    part,
                    partIndex
                ) => {

                    const words =
                        part.split(
                            /(\s+)/
                        );

                    words.forEach(
                        token => {
                            if (
                                token === ""
                            ) {
                                return;
                            }

                            const style = {
                                bold:
                                    Boolean(
                                        segment.bold
                                    ),
                                italic:
                                    Boolean(
                                        segment.italic
                                    )
                            };

                            const pieces =
                                splitTokenToFitWidth(
                                    token,
                                    style,
                                    currentWidth,
                                    maxWidth,
                                    fontSize,
                                    contentConfig
                                );

                            pieces.forEach(
                                piece => {
                                    if (
                                        piece === "\n"
                                    ) {
                                        pushCurrentLine();
                                        return;
                                    }

                                    const pieceWidth =
                                        measureRichText(
                                            piece,
                                            style,
                                            fontSize,
                                            contentConfig
                                        );

                                    const available =
                                        maxWidth -
                                        currentWidth();

                                    if (
                                        pieceWidth <=
                                        available + 0.001
                                    ) {
                                        currentLine.push({
                                            text:
                                                piece,
                                            bold:
                                                style.bold,
                                            italic:
                                                style.italic
                                        });

                                        return;
                                    }

                                    /*
                                     * Pokud jde o mezeru,
                                     * nepřidáváme ji jako
                                     * samostatný první znak
                                     * nového řádku.
                                     */

                                    if (
                                        /^\s+$/.test(
                                            piece
                                        )
                                    ) {
                                        return;
                                    }

                                    pushCurrentLine();

                                    currentLine.push({
                                        text:
                                            piece.trimStart(),
                                        bold:
                                            style.bold,
                                        italic:
                                            style.italic
                                    });
                                }
                            );
                        }
                    );

                    if (
                        partIndex <
                        parts.length - 1
                    ) {
                        pushCurrentLine();
                    }
                }
            );
        }
    );

    if (
        currentLine.length > 0
    ) {
        pushCurrentLine();
    }

    return lines;
}


function splitTokenToFitWidth(
    token,
    style,
    currentWidth,
    maxWidth,
    fontSize,
    contentConfig
) {
    if (
        measureRichText(
            token,
            style,
            fontSize,
            contentConfig
        ) <=
        maxWidth - currentWidth()
    ) {
        return [token];
    }

    if (
        /^\s+$/.test(token)
    ) {
        return [token];
    }

    const pieces = [];

    let current = "";

    for (
        const character of token
    ) {
        const test =
            current +
            character;

        const width =
            measureRichText(
                test,
                style,
                fontSize,
                contentConfig
            );

        const available =
            maxWidth -
            currentWidth();

        if (
            current &&
            width >
                available
        ) {
            pieces.push(
                current
            );

            current =
                character;
        } else {
            current =
                test;
        }
    }

    if (
        current
    ) {
        pieces.push(
            current
        );
    }

    return pieces;
}


function measureRichText(
    text,
    style,
    fontSize,
    contentConfig
) {
    ctx.font =
        buildRichTextFont(
            style,
            fontSize,
            contentConfig.font
        );

    return ctx.measureText(
        text
    ).width;
}


function buildRichTextFont(
    style,
    fontSize,
    fontConfig
) {
    const family =
        fontConfig?.family ??
        GLOBAL_DEFAULTS.textFontFamily;

    const weight =
        style.bold
            ? 700
            : (
                fontConfig?.weight ??
                GLOBAL_DEFAULTS.textFontWeight
            );

    const fontStyle =
        style.italic
            ? "italic"
            : (
                fontConfig?.style ??
                GLOBAL_DEFAULTS.textFontStyle
            );

    return buildFont(
        fontStyle,
        weight,
        fontSize,
        family
    );
}


function calculateRichTextLineHeight(
    contentConfig,
    fontSize
) {
    return (
        fontSize *
        (
            contentConfig.lineHeight ??
            GLOBAL_DEFAULTS.textLineHeight
        )
    );
}


/* =========================================================
   SEGMENT HELPERS
========================================================= */

function mergeRichRuns(
    runs
) {
    const result = [];

    runs.forEach(
        run => {
            if (
                !run ||
                !run.text
            ) {
                return;
            }

            const previous =
                result[
                    result.length - 1
                ];

            if (
                previous &&
                previous.bold ===
                    run.bold &&
                previous.italic ===
                    run.italic
            ) {
                previous.text +=
                    run.text;
            } else {
                result.push({
                    text:
                        run.text,
                    bold:
                        Boolean(
                            run.bold
                        ),
                    italic:
                        Boolean(
                            run.italic
                        )
                });
            }
        }
    );

    return result;
}


function linesToSegments(
    lines
) {
    const segments = [];

    lines.forEach(
        (
            line,
            lineIndex
        ) => {
            line.runs.forEach(
                run => {
                    const previous =
                        segments[
                            segments.length - 1
                        ];

                    if (
                        previous &&
                        previous.bold ===
                            run.bold &&
                        previous.italic ===
                            run.italic
                    ) {
                        previous.text +=
                            run.text;
                    } else {
                        segments.push({
                            text:
                                run.text,
                            bold:
                                Boolean(
                                    run.bold
                                ),
                            italic:
                                Boolean(
                                    run.italic
                                )
                        });
                    }
                }
            );

            if (
                lineIndex <
                lines.length - 1
            ) {
                segments.push({
                    text: "\n",
                    bold: false,
                    italic: false
                });
            }
        }
    );

    return normalizeRichTextSegments(
        segments
    );
}


function cloneSegments(
    segments
) {
    return normalizeRichTextSegments(
        JSON.parse(
            JSON.stringify(
                segments || []
            )
        )
    );
}


function combineSegments(
    first,
    second
) {
    return normalizeRichTextSegments([
        ...cloneSegments(first),
        {
            text: "\n",
            bold: false,
            italic: false
        },
        ...cloneSegments(second)
    ]);
}


/* =========================================================
   POST 3 FIRST PAGE
========================================================= */

function drawPost3FirstPage(
    template
) {
    const page =
        template.pages.first;

    drawPost3Background(
        page.background,
        "first"
    );

    drawPost3Elements(
        page.elements || []
    );
}


/* =========================================================
   POST 3 CONTENT PAGE
========================================================= */

function drawPost3ContentPage(
    template,
    page
) {
    const config =
        template.pages.content;

    drawPost3Background(
        config.background,
        "content"
    );

    drawRichTextPage(
        page,
        config
    );

    drawPost3ContentLogo(
        template
    );
}


/* =========================================================
   POST 3 BACKGROUND
========================================================= */

function drawPost3Background(
    background,
    type
) {
    const template =
        state.currentTemplate;

    drawCanvasColor(
        template.canvas
    );

    if (!background) {
        return;
    }

    const assetKey =
        type === "first"
            ? "post3:firstBackground"
            : "post3:contentBackground";

    const image =
        state.values.backgroundType ===
            "custom"
            ? (
                background.sourceField &&
                state.images[
                    background.sourceField
                ]
            )
            : state.assets[
                assetKey
            ];

    if (!image) {
        /*
         * Overlay se může vykreslit
         * i bez obrázku.
         */
        if (
            background.overlay
        ) {
            drawFill(
                background.overlay,
                0,
                0,
                canvas.width,
                canvas.height
            );
        }

        return;
    }

    drawImageElementWithOptions(
        image,
        {
            box: {
                x: 0,
                y: 0,
                width:
                    canvas.width,
                height:
                    canvas.height
            },

            fit:
                background.fit ??
                GLOBAL_DEFAULTS.imageFit,

            grayscale:
                background.grayscale ===
                true,

            opacity:
                background.opacity !==
                undefined
                    ? background.opacity
                    : undefined
        }
    );

    if (
        background.overlay
    ) {
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
   POST 3 ELEMENTS
========================================================= */

function drawPost3Elements(
    elements
) {
    elements.forEach(
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

            /*
             * POST 3 title/subtitle používají
             * vlastní skupinu.
             */

            if (
                element.group
            ) {
                return;
            }

            if (
                element.type === "logo"
            ) {
                drawPost3LogoElement(
                    element
                );

                return;
            }

            drawElement(
                element
            );
        }
    );

    /*
     * mainText group
     */

    const group =
        state.currentTemplate.pages
            ?.first?.groups
            ?.mainText;

    if (group) {
        drawPost3FirstTextGroup(
            elements,
            group
        );
    }
}


/* =========================================================
   POST 3 FIRST TEXT GROUP
========================================================= */

function drawPost3FirstTextGroup(
    elements,
    groupConfig
) {
    const layouts = [];

    elements.forEach(
        element => {
            if (
                element.group !==
                "mainText"
            ) {
                return;
            }

            if (
                element.type !==
                "text"
            ) {
                return;
            }

            if (
                element.visibleWhen &&
                !evaluateCondition(
                    element.visibleWhen
                )
            ) {
                return;
            }

            const text =
                state.values[
                    element.field
                ];

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

            const layout =
                prepareTextLayout(
                    element,
                    box
                );

            if (!layout) {
                return;
            }

            layouts.push({
                element,
                box,
                layout
            });
        }
    );

    if (
        layouts.length === 0
    ) {
        return;
    }

    const gap =
        groupConfig.gap !==
        undefined
            ? Number(
                groupConfig.gap
            )
            : 0;

    const totalHeight =
        layouts.reduce(
            (
                total,
                item
            ) =>
                total +
                item.layout.totalHeight,
            0
        ) +
        Math.max(
            0,
            layouts.length - 1
        ) *
        gap;

    const groupBox =
        groupConfig.box
            ? {
                x:
                    groupConfig.box.x ??
                    0,
                y:
                    groupConfig.box.y ??
                    0,
                width:
                    groupConfig.box.width ??
                    canvas.width,
                height:
                    groupConfig.box.height ??
                    canvas.height
            }
            : {
                x: 0,
                y: 0,
                width:
                    canvas.width,
                height:
                    canvas.height
            };

    const verticalAlign =
        groupConfig.verticalAlign ??
        "top";

    let currentY;

    if (
        verticalAlign ===
        "center"
    ) {
        currentY =
            groupBox.y +
            (
                groupBox.height -
                totalHeight
            ) / 2;
    }

    else if (
        verticalAlign ===
        "bottom"
    ) {
        currentY =
            groupBox.y +
            groupBox.height -
            totalHeight;
    }

    else {
        currentY =
            groupBox.y;
    }

    layouts.forEach(
        (
            item,
            index
        ) => {
            const drawBox = {
                x:
                    item.box.x,
                y:
                    currentY,
                width:
                    item.box.width,
                height:
                    item.layout.totalHeight
            };

            drawPreparedTextElement(
                item.element,
                drawBox,
                item.layout
            );

            currentY +=
                item.layout.totalHeight;

            if (
                index <
                layouts.length - 1
            ) {
                currentY += gap;
            }
        }
    );
}


/* =========================================================
   POST 3 LOGO
========================================================= */

function drawPost3LogoElement(
    element
) {
    const variant =
        state.values.logoVariant ||
        "white";

    const asset =
        variant === "blue"
            ? state.assets[
                "post3:logo-blue"
            ]
            : (
                state.assets[
                    "post3:logo-white"
                ] ||
                state.assets[
                    "post3:logo-white-fallback"
                ]
            );

    if (!asset) {
        return;
    }

    const box =
        resolveElementBox(
            element
        );

    drawImageElementWithOptions(
        asset,
        {
            box,
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
   POST 3 CONTENT LOGO
========================================================= */

function drawPost3ContentLogo(
    template
) {
    if (
        state.values.logoVisible !==
        true
    ) {
        return;
    }

    if (
        state.values.logoOnContent !==
        true
    ) {
        return;
    }

    const elements =
        template.pages.content
            .elements || [];

    elements.forEach(
        element => {
            if (
                element.type !==
                "logo"
            ) {
                return;
            }

            if (
                element.visibleWhen &&
                !evaluateCondition(
                    element.visibleWhen
                )
            ) {
                return;
            }

            drawPost3LogoElement(
                element
            );
        }
    );
}


/* =========================================================
   POST 3 RICH TEXT DRAWING
========================================================= */

function drawRichTextPage(
    page,
    config
) {
    const box =
        config.textBox;

    const fontSize =
        page.fontSize ??
        config.font?.size ??
        25;

    const lineHeight =
        page.lineHeight ??
        calculateRichTextLineHeight(
            config,
            fontSize
        );

    const lines =
        page.lines ||
        [];

    ctx.save();

    ctx.fillStyle =
        config.color ??
        "#FFFFFF";

    ctx.textAlign =
        config.align ??
        "left";

    ctx.textBaseline =
        "top";

    lines.forEach(
        (
            line,
            lineIndex
        ) => {
            let currentX =
                box.x;

            line.runs.forEach(
                run => {
                    if (
                        !run.text
                    ) {
                        return;
                    }

                    ctx.font =
                        buildRichTextFont(
                            run,
                            fontSize,
                            config.font
                        );

                    ctx.fillText(
                        run.text,
                        currentX,
                        box.y +
                        lineIndex *
                        lineHeight
                    );

                    currentX +=
                        ctx.measureText(
                            run.text
                        ).width;
                }
            );
        }
    );

    ctx.restore();
}


/* =========================================================
   STANDARD BACKGROUND
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

    drawCanvasColor(
        template.canvas
    );

    let image = null;

    if (
        state.values.backgroundType ===
            "custom" &&
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

    else if (
        state.values.backgroundType !==
            "custom" &&
        background.default &&
        background.default.type ===
            "asset"
    ) {
        image =
            state.assets
                .defaultBackground;
    }

    if (!image) {
        return;
    }

    const fit =
        background.fit ??
        GLOBAL_DEFAULTS.imageFit;

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

    if (
        background.overlay
    ) {
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

    const renderedGroups =
        new Set();

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

            if (element.group) {
                const groupId =
                    typeof element.group === "string"
                        ? element.group
                        : element.group.id;

                if (!groupId) {
                    drawElement(
                        element
                    );

                    return;
                }

                if (
                    renderedGroups.has(
                        groupId
                    )
                ) {
                    return;
                }

                renderedGroups.add(
                    groupId
                );

                drawGroup(
                    template,
                    groupId
                );

                return;
            }

            drawElement(
                element
            );
        }
    );
}


/* =========================================================
   SINGLE ELEMENT
========================================================= */

function drawElement(element) {
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


/* =========================================================
   GROUP
========================================================= */

function drawGroup(
    template,
    groupId
) {
    const groupConfig =
        template.groups?.[groupId];

    if (!groupConfig) {
        console.warn(
            `Group "${groupId}" není definovaný v template.json.`
        );

        return;
    }

    const groupElements =
        template.elements.filter(
            element => {

                const elementGroup =
                    typeof element.group === "string"
                        ? element.group
                        : element.group?.id;

                return (
                    elementGroup ===
                    groupId
                );
            }
        );

    const layouts = [];

    groupElements.forEach(
        element => {

            if (
                element.type !==
                "text"
            ) {
                return;
            }

            if (
                element.hidden === true
            ) {
                return;
            }

            if (
                element.visibleWhen &&
                !evaluateCondition(
                    element.visibleWhen
                )
            ) {
                return;
            }

            const text =
                state.values[
                    element.field
                ];

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

            const layout =
                prepareTextLayout(
                    element,
                    box
                );

            if (!layout) {
                return;
            }

            layouts.push({
                element,
                box,
                layout
            });
        }
    );

    if (
        layouts.length === 0
    ) {
        return;
    }

    const gap =
        groupConfig.gap !==
        undefined
            ? Number(
                groupConfig.gap
            )
            : 0;

    const totalHeight =
        layouts.reduce(
            (
                total,
                item
            ) => {
                return (
                    total +
                    item.layout.totalHeight
                );
            },
            0
        ) +
        Math.max(
            0,
            layouts.length - 1
        ) *
            gap;

    const groupBox =
        groupConfig.box
            ? {
                x:
                    groupConfig.box.x ??
                    0,

                y:
                    groupConfig.box.y ??
                    0,

                width:
                    groupConfig.box.width ??
                    canvas.width,

                height:
                    groupConfig.box.height ??
                    canvas.height
            }
            : {
                x: 0,
                y: 0,
                width: canvas.width,
                height: canvas.height
            };

    const verticalAlign =
        groupConfig.verticalAlign ??
        "top";

    let currentY;

    if (
        verticalAlign ===
        "center"
    ) {
        currentY =
            groupBox.y +
            (
                groupBox.height -
                totalHeight
            ) / 2;
    }

    else if (
        verticalAlign ===
        "bottom"
    ) {
        currentY =
            groupBox.y +
            groupBox.height -
            totalHeight;
    }

    else {
        currentY =
            groupBox.y;
    }

    layouts.forEach(
        (
            item,
            index
        ) => {

            const drawBox = {
                x: item.box.x,
                y: currentY,
                width: item.box.width,
                height:
                    item.layout.totalHeight
            };

            drawPreparedTextElement(
                item.element,
                drawBox,
                item.layout
            );

            currentY +=
                item.layout.totalHeight;

            if (
                index <
                layouts.length - 1
            ) {
                currentY += gap;
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
    if (!element.position) {
        return box;
    }

    let fieldId = null;
    let positions = null;

    if (
        typeof element.position ===
            "object"
    ) {
        fieldId =
            element.position.field;

        positions =
            element.position.positions;
    }

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

    const layout =
        prepareTextLayout(
            element,
            box
        );

    if (!layout) {
        return;
    }

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
                layout.totalHeight
            ) / 2;
    }

    else if (
        verticalAlign ===
        "bottom"
    ) {
        startY =
            box.y +
            box.height -
            layout.totalHeight;
    }

    else {
        startY =
            box.y;
    }

    drawPreparedTextElement(
        element,
        {
            ...box,
            y: startY
        },
        layout
    );
}


/* =========================================================
   TEXT LAYOUT
========================================================= */

function prepareTextLayout(
    element,
    box
) {
    const text =
        state.values[element.field];

    if (
        text === undefined ||
        text === null ||
        text === ""
    ) {
        return null;
    }

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

        return null;
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

    return {
        lines,
        fontSize,
        lineHeight,
        totalHeight,
        fontFamily,
        fontWeight,
        fontStyle
    };
}


/* =========================================================
   PREPARED TEXT DRAWING
========================================================= */

function drawPreparedTextElement(
    element,
    box,
    layout
) {
    ctx.save();

    ctx.font =
        buildFont(
            layout.fontStyle,
            layout.fontWeight,
            layout.fontSize,
            layout.fontFamily
        );

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

    layout.lines.forEach(
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
                box.y +
                    index *
                    layout.lineHeight
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

    if (
        fill &&
        typeof fill === "object" &&
        fill.opacity !== undefined
    ) {
        ctx.globalAlpha =
            fill.opacity;
    }

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
        (
            color,
            index
        ) => {
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
   POST 3 PREVIEW CONTROLS
========================================================= */

let post3PreviewContainer = null;

function ensurePost3PreviewControls() {
    if (
        post3PreviewContainer ||
        !isPost3Template()
    ) {
        return;
    }

    post3PreviewContainer =
        document.createElement("div");

    post3PreviewContainer.id =
        "post3-preview-controls";

    post3PreviewContainer.style.marginTop =
        "12px";

    post3PreviewContainer.style.display =
        "flex";

    post3PreviewContainer.style.flexDirection =
        "column";

    post3PreviewContainer.style.gap =
        "10px";

    canvas.parentElement?.appendChild(
        post3PreviewContainer
    );
}


function updatePost3PreviewControls() {
    if (
        !isPost3Template()
    ) {
        if (
            post3PreviewContainer
        ) {
            post3PreviewContainer.remove();
            post3PreviewContainer = null;
        }

        return;
    }

    ensurePost3PreviewControls();

    if (
        !post3PreviewContainer
    ) {
        return;
    }

    post3PreviewContainer.innerHTML = "";

    const navigation =
        document.createElement("div");

    navigation.style.display =
        "flex";

    navigation.style.alignItems =
        "center";

    navigation.style.justifyContent =
        "center";

    navigation.style.gap =
        "18px";

    const previous =
        document.createElement("button");

    previous.type = "button";
    previous.textContent = "‹";

    previous.disabled =
        state.currentPage <= 0;

    previous.addEventListener(
        "click",
        () => {
            if (
                state.currentPage > 0
            ) {
                state.currentPage--;
                render();
            }
        }
    );

    const counter =
        document.createElement("span");

    counter.textContent =
        `${state.currentPage + 1} / ${state.pages.length}`;

    const next =
        document.createElement("button");

    next.type = "button";
    next.textContent = "›";

    next.disabled =
        state.currentPage >=
        state.pages.length - 1;

    next.addEventListener(
        "click",
        () => {
            if (
                state.currentPage <
                state.pages.length - 1
            ) {
                state.currentPage++;
                render();
            }
        }
    );

    navigation.appendChild(
        previous
    );

    navigation.appendChild(
        counter
    );

    navigation.appendChild(
        next
    );

    post3PreviewContainer.appendChild(
        navigation
    );

    const thumbnails =
        document.createElement("div");

    thumbnails.style.display =
        "flex";

    thumbnails.style.flexWrap =
        "wrap";

    thumbnails.style.gap =
        "8px";

    thumbnails.style.justifyContent =
        "center";

    state.pages.forEach(
        (
            page,
            index
        ) => {
            const thumbnail =
                document.createElement(
                    "button"
                );

            thumbnail.type =
                "button";

            thumbnail.textContent =
                String(index + 1);

            thumbnail.title =
                `Strana ${index + 1}`;

            thumbnail.className =
                "post3-thumbnail";

            if (
                index ===
                state.currentPage
            ) {
                thumbnail.classList.add(
                    "post3-thumbnail-active"
                );
            }

            thumbnail.addEventListener(
                "click",
                () => {
                    state.currentPage =
                        index;

                    render();
                }
            );

            thumbnails.appendChild(
                thumbnail
            );
        }
    );

    post3PreviewContainer.appendChild(
        thumbnails
    );
}


/* =========================================================
   KEYBOARD NAVIGATION
========================================================= */

document.addEventListener(
    "keydown",
    event => {
        if (
            !isPost3Template()
        ) {
            return;
        }

        const active =
            document.activeElement;

        if (
            active &&
            (
                active.tagName ===
                    "INPUT" ||
                active.tagName ===
                    "TEXTAREA" ||
                active.isContentEditable
            )
        ) {
            return;
        }

        if (
            event.key === "ArrowLeft" &&
            state.currentPage > 0
        ) {
            state.currentPage--;
            render();
        }

        else if (
            event.key === "ArrowRight" &&
            state.currentPage <
                state.pages.length - 1
        ) {
            state.currentPage++;
            render();
        }
    }
);


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
        if (
            field.visibleWhen &&
            !evaluateCondition(
                field.visibleWhen
            )
        ) {
            continue;
        }

        if (
            field.required &&
            !hasFieldValue(
                field
            )
        ) {
            return false;
        }

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

    if (
        field.type ===
        "richtext"
    ) {
        return (
            Array.isArray(value) &&
            value.some(
                segment =>
                    segment &&
                    typeof segment.text ===
                        "string" &&
                    segment.text.length > 0
            )
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
    async () => {
        if (
            !validateFields()
        ) {
            return;
        }

        if (
            isPost3Template()
        ) {
            await downloadPost3Pages();
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
   POST 3 DOWNLOAD
========================================================= */

async function downloadPost3Pages() {
    const previousPage =
        state.currentPage;

    const pages =
        state.pages.length
            ? state.pages
            : buildPost3Pages();

    for (
        let index = 0;
        index < pages.length;
        index++
    ) {
        state.currentPage =
            index;

        render();

        await waitForRender();

        const blob =
            await canvasToBlob(
                canvas
            );

        if (!blob) {
            continue;
        }

        downloadBlob(
            blob,
            `${state.currentTemplate.id}-${index + 1}.png`
        );

        /*
         * Malá prodleva mezi soubory,
         * aby prohlížeč neblokoval více
         * automatických downloadů.
         */

        await delay(120);
    }

    state.currentPage =
        Math.min(
            previousPage,
            pages.length - 1
        );

    render();
}


function canvasToBlob(
    targetCanvas
) {
    return new Promise(
        resolve => {
            targetCanvas.toBlob(
                blob =>
                    resolve(blob),
                "image/png"
            );
        }
    );
}


function downloadBlob(
    blob,
    filename
) {
    const url =
        URL.createObjectURL(
            blob
        );

    const link =
        document.createElement(
            "a"
        );

    link.href =
        url;

    link.download =
        filename;

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    setTimeout(
        () =>
            URL.revokeObjectURL(
                url
            ),
        1000
    );
}


function waitForRender() {
    return new Promise(
        resolve =>
            requestAnimationFrame(
                () =>
                    requestAnimationFrame(
                        resolve
                    )
            )
    );
}


function delay(
    milliseconds
) {
    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );
}


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
        state.pages = [];
        state.currentPage = 0;

        if (
            post3PreviewContainer
        ) {
            post3PreviewContainer.remove();
            post3PreviewContainer = null;
        }

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
