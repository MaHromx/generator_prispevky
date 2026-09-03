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

init();

async function init() {
    try {
        const response = await fetch(TEMPLATE_INDEX_URL);

        if (!response.ok) {
            throw new Error("Nepodařilo se načíst seznam šablon.");
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

        card.addEventListener("click", () => {
            openTemplate(template.id);
        });

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
            throw new Error("Šablonu se nepodařilo načíst.");
        }

        const template = await response.json();

        state.currentTemplate = template;
        state.values = {};
        state.images = {};
        state.assets = {};

        template.fields.forEach(field => {
            if (field.default !== undefined) {
                state.values[field.id] = field.default;
            } else {
                state.values[field.id] = "";
            }
        });

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
   FORM
========================================================= */

function renderForm() {
    formContainer.innerHTML = "";

    state.currentTemplate.fields.forEach(field => {
        const wrapper = document.createElement("div");

        wrapper.className = "form-field";
        wrapper.dataset.fieldId = field.id;

        const label = document.createElement("label");
        label.textContent = field.label;

        wrapper.appendChild(label);

        let input;

        if (field.type === "textarea") {
            input = document.createElement("textarea");

            if (field.placeholder) {
                input.placeholder = field.placeholder;
            }

        } else if (field.type === "text") {
            input = document.createElement("input");
            input.type = "text";

        } else if (field.type === "select") {
            input = document.createElement("select");

            field.options.forEach(option => {
                const optionElement = document.createElement("option");

                optionElement.value = option.value;
                optionElement.textContent = option.label;

                input.appendChild(optionElement);
            });

        } else if (field.type === "image") {
            input = document.createElement("input");
            input.type = "file";
            input.accept = field.accept || "image/*";

        } else {
            console.warn(
                `Neznámý typ pole: ${field.type}`
            );

            return;
        }

        if (field.type !== "image") {
            input.value = state.values[field.id] || "";
        }

        input.addEventListener("input", () => {
            state.values[field.id] = input.value;

            updateFieldVisibility();
            updateDownloadState();
            render();
        });

        input.addEventListener("change", () => {
            if (field.type === "image") {
                handleImageInput(field, input);
            } else {
                state.values[field.id] = input.value;
            }

            updateFieldVisibility();
            updateDownloadState();
            render();
        });

        wrapper.appendChild(input);

        formContainer.appendChild(wrapper);
    });

    updateFieldVisibility();
    updateDownloadState();
}


/* =========================================================
   FIELD VISIBILITY
========================================================= */

function updateFieldVisibility() {
    state.currentTemplate.fields.forEach(field => {
        const wrapper = formContainer.querySelector(
            `[data-field-id="${field.id}"]`
        );

        if (!wrapper) {
            return;
        }

        const visible = evaluateCondition(field.visibleWhen);

        wrapper.style.display = visible ? "" : "none";
    });
}


/* =========================================================
   CONDITIONS
========================================================= */

function evaluateCondition(condition) {
    if (!condition) {
        return true;
    }

    const actualValue = state.values[condition.field];

    if (condition.equals !== undefined) {
        return actualValue === condition.equals;
    }

    return true;
}


/* =========================================================
   IMAGE INPUT
========================================================= */

function handleImageInput(field, input) {
    const file = input.files[0];

    if (!file) {
        delete state.images[field.id];
        return;
    }

    const image = new Image();

    image.onload = () => {
        state.images[field.id] = image;

        updateDownloadState();
        render();
    };

    image.src = URL.createObjectURL(file);
}


/* =========================================================
   TEMPLATE ASSETS
========================================================= */

async function loadTemplateAssets() {
    const template = state.currentTemplate;

    if (!template.background?.default) {
        return;
    }

    const defaultSource = template.background.default;

    if (defaultSource.type !== "asset") {
        return;
    }

    const image = new Image();

    image.onload = () => {
        state.assets.defaultBackground = image;

        render();
    };

    image.onerror = () => {
        console.error(
            `Nepodařilo se načíst ${defaultSource.src}`
        );
    };

    image.src =
        `templates/${encodeURIComponent(template.id)}/${defaultSource.src}`;
}


/* =========================================================
   RENDER
========================================================= */

function render() {
    const template = state.currentTemplate;

    if (!template) {
        return;
    }

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    drawCanvasBackground(template);

    drawElements(template);
}


/* =========================================================
   BACKGROUND
========================================================= */

function drawCanvasBackground(template) {
    const background = template.background;

    ctx.fillStyle =
        template.canvas.background || "#000000";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    let image = null;

    if (
        background.sourceField &&
        state.images[background.sourceField]
    ) {
        image = state.images[background.sourceField];

    } else if (
        background.default?.type === "asset"
    ) {
        image = state.assets.defaultBackground;
    }

    if (!image) {
        return;
    }

    drawImageCover(
        image,
        0,
        0,
        canvas.width,
        canvas.height,
        background.grayscale
    );

    if (background.overlay) {
        ctx.fillStyle = hexToRgba(
            background.overlay.color,
            background.overlay.opacity
        );

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );
    }
}


/* =========================================================
   ELEMENTS
========================================================= */

function drawElements(template) {
    template.elements.forEach(element => {
        if (element.type === "text") {
            drawTextElement(element);
        }

        else if (element.type === "shape") {
            drawShapeElement(element);
        }

        else if (element.type === "image") {
            drawImageElement(element);
        }

        else if (element.type === "line") {
            drawLineElement(element);
        }

        else {
            console.warn(
                `Neznámý element: ${element.type}`
            );
        }
    });
}


/* =========================================================
   TEXT
========================================================= */

function drawTextElement(element) {
    const text = state.values[element.field];

    if (!text) {
        return;
    }

    const box = element.box;
    const font = element.font;

    let fontSize = font.size;

    let lines;

    while (fontSize >= font.minSize) {
        ctx.font =
            `${font.weight} ${fontSize}px ${font.family}`;

        lines = wrapText(
            text,
            box.width,
            element.maxLines
        );

        if (lines.length <= element.maxLines) {
            break;
        }

        fontSize -= font.shrinkStep;
    }

    if (lines.length > element.maxLines) {
        lines = lines.slice(0, element.maxLines);
    }

    const lineHeight =
        fontSize * element.lineHeight;

    const totalHeight =
        lines.length * lineHeight;

    let startY;

    if (element.verticalAlign === "center") {
        startY =
            box.y +
            (box.height - totalHeight) / 2;
    } else if (element.verticalAlign === "bottom") {
        startY =
            box.y +
            box.height -
            totalHeight;
    } else {
        startY = box.y;
    }

    ctx.fillStyle = element.color || "#FFFFFF";
    ctx.textAlign = element.align || "left";
    ctx.textBaseline = "top";

    lines.forEach((line, index) => {
        let x = box.x;

        if (element.align === "center") {
            x += box.width / 2;
        }

        if (element.align === "right") {
            x += box.width;
        }

        ctx.fillText(
            line,
            x,
            startY + index * lineHeight
        );
    });
}


/* =========================================================
   TEXT WRAPPING
========================================================= */

function wrapText(text, maxWidth, maxLines) {
    const paragraphs = String(text).split("\n");

    const lines = [];

    paragraphs.forEach(paragraph => {
        if (paragraph === "") {
            lines.push("");
            return;
        }

        const words = paragraph.split(/\s+/);

        let currentLine = "";

        words.forEach(word => {
            if (ctx.measureText(word).width > maxWidth) {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = "";
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
                ctx.measureText(testLine).width <= maxWidth
            ) {
                currentLine = testLine;

            } else {
                if (currentLine) {
                    lines.push(currentLine);
                }

                currentLine = word;
            }
        });

        if (currentLine) {
            lines.push(currentLine);
        }
    });

    return lines;
}


function splitLongWord(word, maxWidth, lines) {
    let current = "";

    for (const character of word) {
        const test = current + character;

        if (
            ctx.measureText(test).width <= maxWidth
        ) {
            current = test;
        } else {
            if (current) {
                lines.push(current);
            }

            current = character;
        }
    }

    if (current) {
        lines.push(current);
    }
}


/* =========================================================
   SHAPE
========================================================= */

function drawShapeElement(element) {
    const x = element.x || 0;
    const y = element.y || 0;
    const width = element.width || 0;
    const height = element.height || 0;

    ctx.fillStyle =
        element.color || "#FFFFFF";

    ctx.fillRect(
        x,
        y,
        width,
        height
    );
}


/* =========================================================
   IMAGE ELEMENT
========================================================= */

function drawImageElement(element) {
    const image = state.images[element.field];

    if (!image) {
        return;
    }

    drawImageCover(
        image,
        element.x,
        element.y,
        element.width,
        element.height,
        element.grayscale
    );
}


/* =========================================================
   LINE
========================================================= */

function drawLineElement(element) {
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
        element.color || "#FFFFFF";

    ctx.lineWidth =
        element.width || 1;

    ctx.stroke();
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
        image.width / image.height;

    const targetRatio =
        width / height;

    let sourceWidth;
    let sourceHeight;
    let sourceX;
    let sourceY;

    if (imageRatio > targetRatio) {
        sourceHeight = image.height;
        sourceWidth =
            image.height * targetRatio;

        sourceX =
            (image.width - sourceWidth) / 2;

        sourceY = 0;

    } else {
        sourceWidth = image.width;
        sourceHeight =
            image.width / targetRatio;

        sourceX = 0;

        sourceY =
            (image.height - sourceHeight) / 2;
    }

    ctx.save();

    if (grayscale) {
        ctx.filter = "grayscale(100%)";
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
   DOWNLOAD VALIDATION
========================================================= */

function updateDownloadState() {
    if (!state.currentTemplate) {
        downloadButton.disabled = true;
        return;
    }

    const valid = validateFields();

    downloadButton.disabled = !valid;
}


function validateFields() {
    const fields =
        state.currentTemplate.fields;

    for (const field of fields) {
        if (
            field.required &&
            !state.values[field.id]
        ) {
            return false;
        }

        if (
            field.requiredWhen &&
            evaluateCondition(field.requiredWhen)
        ) {
            if (!state.images[field.id]) {
                return false;
            }
        }
    }

    return true;
}


/* =========================================================
   DOWNLOAD
========================================================= */

downloadButton.addEventListener(
    "click",
    () => {
        if (!validateFields()) {
            return;
        }

        canvas.toBlob(blob => {
            if (!blob) {
                return;
            }

            const url =
                URL.createObjectURL(blob);

            const link =
                document.createElement("a");

            link.href = url;
            link.download =
                `${state.currentTemplate.id}.png`;

            link.click();

            URL.revokeObjectURL(url);

        }, "image/png");
    }
);


/* =========================================================
   BACK
========================================================= */

backButton.addEventListener(
    "click",
    () => {
        state.currentTemplate = null;
        state.values = {};
        state.images = {};
        state.assets = {};

        editor.classList.add("hidden");
        templateSelection.classList.remove("hidden");

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

function hexToRgba(hex, opacity) {
    const clean = hex.replace("#", "");

    const r =
        parseInt(clean.substring(0, 2), 16);

    const g =
        parseInt(clean.substring(2, 4), 16);

    const b =
        parseInt(clean.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}


function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
