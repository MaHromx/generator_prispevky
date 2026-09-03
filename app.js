let templates = [];
let currentTemplate = null;
let currentImage = null;

const canvas = document.getElementById("preview-canvas");
const ctx = canvas.getContext("2d");

const templateSelection = document.getElementById("template-selection");
const editor = document.getElementById("editor");

const templateList = document.getElementById("template-list");
const templateTitle = document.getElementById("template-title");
const formContainer = document.getElementById("form-container");

const backButton = document.getElementById("back-button");
const downloadButton = document.getElementById("download-button");


// --------------------------------------------------
// NAČTENÍ SEZNAMU ŠABLON
// --------------------------------------------------

async function loadTemplates() {

    try {

        const response = await fetch("templates/index.json");

        if (!response.ok) {
            throw new Error("Nepodařilo se načíst seznam šablon.");
        }

        templates = await response.json();

        showTemplateSelection();

    } catch (error) {

        console.error(error);

        templateList.innerHTML = `
            <p>
                Nepodařilo se načíst šablony.
            </p>
        `;
    }
}


// --------------------------------------------------
// ZOBRAZENÍ ŠABLON
// --------------------------------------------------

function showTemplateSelection() {

    templateSelection.classList.remove("hidden");
    editor.classList.add("hidden");

    templateList.innerHTML = "";

    templates.forEach(template => {

        const card = document.createElement("div");

        card.className = "template-card";

        card.innerHTML = `
            <h3>${template.name}</h3>
            <p>${template.description || ""}</p>
        `;

        card.addEventListener("click", () => {
            openTemplate(template);
        });

        templateList.appendChild(card);

    });
}


// --------------------------------------------------
// OTEVŘENÍ ŠABLONY
// --------------------------------------------------

async function openTemplate(template) {

    try {

        const response = await fetch(
            `templates/${template.id}/template.json`
        );

        if (!response.ok) {
            throw new Error("Konfigurace šablony nebyla nalezena.");
        }

        currentTemplate = await response.json();

        templateSelection.classList.add("hidden");
        editor.classList.remove("hidden");

        templateTitle.textContent = currentTemplate.name;

        createForm();

        setupCanvas();

        drawTemplate();

    } catch (error) {

        console.error(error);

        alert("Šablonu se nepodařilo načíst.");

    }
}


// --------------------------------------------------
// VYTVOŘENÍ FORMULÁŘE PODLE TEMPLATE.JSON
// --------------------------------------------------

function createForm() {

    formContainer.innerHTML = "";

    currentTemplate.fields.forEach(field => {

        const wrapper = document.createElement("div");

        wrapper.className = "form-field";

        const label = document.createElement("label");

        label.textContent = field.label;

        wrapper.appendChild(label);


        let input;


        // TEXT
        if (field.type === "text") {

            input = document.createElement("input");

            input.type = "text";

        }


        // TEXTAREA
        else if (field.type === "textarea") {

            input = document.createElement("textarea");

        }


        // OBRÁZEK
        else if (field.type === "image") {

            input = document.createElement("input");

            input.type = "file";
            input.accept = "image/*";

        }


        // SELECT
        else if (field.type === "select") {

            input = document.createElement("select");

            field.options.forEach(option => {

                const optionElement =
                    document.createElement("option");

                optionElement.value = option.value;
                optionElement.textContent = option.label;

                input.appendChild(optionElement);

            });

        }


        if (!input) {
            return;
        }


        input.dataset.fieldId = field.id;

        input.addEventListener("input", handleFieldChange);
        input.addEventListener("change", handleFieldChange);

        wrapper.appendChild(input);

        formContainer.appendChild(wrapper);

    });
}


// --------------------------------------------------
// ZMĚNA FORMULÁŘE
// --------------------------------------------------

function handleFieldChange(event) {

    const fieldId = event.target.dataset.fieldId;

    if (event.target.type === "file") {

        const file = event.target.files[0];

        if (!file) {
            currentImage = null;
            drawTemplate();
            return;
        }

        const image = new Image();

        image.onload = function () {

            currentImage = image;

            drawTemplate();

        };

        image.src = URL.createObjectURL(file);

    } else {

        drawTemplate();

    }

}


// --------------------------------------------------
// ZÍSKÁNÍ HODNOT FORMULÁŘE
// --------------------------------------------------

function getFieldValue(id) {

    const element =
        document.querySelector(`[data-field-id="${id}"]`);

    if (!element) {
        return "";
    }

    return element.value;

}


// --------------------------------------------------
// CANVAS
// --------------------------------------------------

function setupCanvas() {

    canvas.width = currentTemplate.width;
    canvas.height = currentTemplate.height;

}


// --------------------------------------------------
// VYKRESLENÍ ŠABLONY
// --------------------------------------------------

function drawTemplate() {

    if (!currentTemplate) {
        return;
    }

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    // POST 1
    if (currentTemplate.id === "post-1") {

        drawPost1();

    }

}


// --------------------------------------------------
// POST 1
// --------------------------------------------------

function drawPost1() {

    const width = 1080;
    const height = 1350;


    // ---------------------------------------------
    // POZADÍ
    // ---------------------------------------------

    if (currentImage) {

        drawImageCover(
            currentImage,
            0,
            0,
            width,
            height
        );

    } else {

        // Pokud není nahraná fotografie,
        // použijeme výchozí obrázek.

        const defaultImage = new Image();

        defaultImage.onload = function () {

            drawImageCover(
                defaultImage,
                0,
                0,
                width,
                height
            );

            drawPost1OverlayAndText();

        };

        defaultImage.src =
            "templates/post-1/default.jpg";

        return;
    }


    drawPost1OverlayAndText();

}


// --------------------------------------------------
// OŘÍZNUTÍ OBRÁZKU NA CELÉ PLÁTNO
// --------------------------------------------------

function drawImageCover(image, x, y, width, height) {

    const imageRatio =
        image.width / image.height;

    const canvasRatio =
        width / height;


    let sourceWidth;
    let sourceHeight;
    let sourceX;
    let sourceY;


    if (imageRatio > canvasRatio) {

        sourceHeight = image.height;
        sourceWidth =
            image.height * canvasRatio;

        sourceX =
            (image.width - sourceWidth) / 2;

        sourceY = 0;

    } else {

        sourceWidth = image.width;

        sourceHeight =
            image.width / canvasRatio;

        sourceX = 0;

        sourceY =
            (image.height - sourceHeight) / 2;

    }


    // ČERNOBÍLÝ OBRAZ

    ctx.save();

    ctx.filter = "grayscale(100%)";

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


// --------------------------------------------------
// POST 1 – OVERLAY + TEXT
// --------------------------------------------------

function drawPost1OverlayAndText() {

    const width = 1080;
    const height = 1350;


    // ---------------------------------------------
    // MODRÝ OVERLAY
    // ---------------------------------------------

    ctx.fillStyle = "rgba(1, 78, 161, 0.19)";

    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    // ---------------------------------------------
    // TEXT
    // ---------------------------------------------

    const text =
        getFieldValue("text");


    if (!text) {
        return;
    }


    const maxWidth = 648;

    const centerX = width / 2;
    const centerY = height / 2;


    const maxFontSize = 53.8;
    const minFontSize = 30;


    let fontSize = maxFontSize;

    let lines;


    while (fontSize >= minFontSize) {

        ctx.font =
            `800 ${fontSize}px Montserrat, Arial, sans-serif`;

        lines =
            wrapText(text, maxWidth);

        const lineHeight =
            fontSize * 1.15;

        const textHeight =
            lines.length * lineHeight;


        if (
            lines.length <= 5 &&
            textHeight <= height * 0.8
        ) {

            break;

        }


        fontSize -= 1;

    }


    if (lines.length > 5) {

        console.warn(
            "Text je příliš dlouhý pro POST 1."
        );

    }


    // ---------------------------------------------
    // VYKRESLENÍ TEXTU
    // ---------------------------------------------

    ctx.save();

    ctx.fillStyle = "#ffffff";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font =
        `800 ${fontSize}px Montserrat, Arial, sans-serif`;


    const lineHeight =
        fontSize * 1.15;

    const textHeight =
        lines.length * lineHeight;

    let y =
        centerY - textHeight / 2 + lineHeight / 2;


    lines.forEach(line => {

        ctx.fillText(
            line,
            centerX,
            y
        );

        y += lineHeight;

    });


    ctx.restore();

}


// --------------------------------------------------
// ZALAMOVÁNÍ TEXTU
// --------------------------------------------------

function wrapText(text, maxWidth) {

    const words =
        text.trim().split(/\s+/);

    const lines = [];

    let currentLine = "";


    words.forEach(word => {

        const testLine =
            currentLine
                ? `${currentLine} ${word}`
                : word;


        const width =
            ctx.measureText(testLine).width;


        if (
            width <= maxWidth ||
            !currentLine
        ) {

            currentLine = testLine;

        } else {

            lines.push(currentLine);

            currentLine = word;

        }

    });


    if (currentLine) {
        lines.push(currentLine);
    }


    return lines;

}


// --------------------------------------------------
// STAŽENÍ PNG
// --------------------------------------------------

downloadButton.addEventListener("click", () => {

    const link =
        document.createElement("a");

    link.download =
        `${currentTemplate.id}.png`;

    link.href =
        canvas.toDataURL("image/png");

    link.click();

});


// --------------------------------------------------
// ZPĚT
// --------------------------------------------------

backButton.addEventListener("click", () => {

    currentTemplate = null;
    currentImage = null;

    showTemplateSelection();

});


// --------------------------------------------------
// START
// --------------------------------------------------

loadTemplates();
