/**
 * TREE CONFIGURATION
 * Replace this URL with your "Current Web App URL" from the Google Apps Script Deploy menu.
 */
const GAS_URL = "https://script.google.com/macros/s/AKfycbxl66GiWLIiRpzWOk3e_1g0U0C-NKlGPgtuyZYeMHNd2CFL3XZuRLiZTSHRSJ7z3Zec/exec";

// Global storage for the flat node list
let allNodesGlobal = [];

// Initialize on page load
window.onload = fetchTree;

/**
 * 1. DATA LOADING
 * Fetches the flat JSON array from Google Sheets and triggers the render.
 */
async function fetchTree() {
    const container = document.getElementById('tree-container');
    container.innerHTML = "<div style='padding:20px; color:#666;'>🌳 Loading Tree Data...</div>";

    try {
        const response = await fetch(GAS_URL);
        const data = await response.json();
        allNodesGlobal = data;

        container.innerHTML = "";
        const treeRoot = buildTree(data);

        if (treeRoot) {
            container.appendChild(renderTree(treeRoot));

            // This ensures that if the checkbox is "Unchecked", 
            // the new tree we just built immediately hides its images.
            updateImageVisibility();

        } else {
            container.innerHTML = "<div style='color:red;'>No root node found. Please check your sheet.</div>";
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        container.innerHTML = "<div style='color:red;'>Error loading tree. Ensure your Web App is deployed and GAS_URL is correct.</div>";
    }
}

/**
 * 2. TREE LOGIC
 * Converts a flat array into a nested parent-child object.
 */
function buildTree(nodes) {
    const map = {};
    let root = null;

    nodes.forEach(node => {
        map[String(node.Node_ID)] = { ...node, children: [] };
    });

    nodes.forEach(node => {
        const parentId = String(node.Parent_ID);
        if (node.Parent_ID == 0 || !map[parentId]) {
            if (!root) root = map[String(node.Node_ID)];
        } else {
            map[parentId].children.push(map[String(node.Node_ID)]);
        }
    });
    return root;
}

/**
 * 3. RENDER LOGIC
 * Layout: [Toggle] [ [Image(45px)] [ID + Content] ]
 */
function renderTree(node) {
    if (!node) return document.createTextNode("");

    const li = document.createElement('li');
    const hasChildren = node.children && node.children.length > 0;

    // --- 1. NEW: The Row Wrapper for Vertical Alignment ---
    const treeRow = document.createElement('div');
    treeRow.className = "tree-row";

    // --- 2. Toggle Button ---
    const toggle = document.createElement('span');
    toggle.className = "toggle-btn";
    if (hasChildren) {
        toggle.innerText = "[-] ";
        toggle.onclick = (e) => {
            e.stopPropagation();
            const isCollapsed = li.classList.toggle('collapsed');
            toggle.innerText = isCollapsed ? "[+] " : "[-] ";
        };
    } else {
        toggle.innerHTML = "&nbsp;&nbsp;"; // Space for leaf nodes
        toggle.style.cursor = "default";
    }

    // --- 3. Node Container ---
    const nodeWrapper = document.createElement('div');
    nodeWrapper.className = "node-container";

    let imageHTML = "";
    if (node.Image_URL && node.Image_URL.length > 10 && node.Image_URL !== "null") {
        imageHTML = `<img src="${node.Image_URL}" referrerpolicy="no-referrer" class="node-image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd; flex-shrink: 0;">`;
    } else {
        imageHTML = `<div class="node-placeholder" style="width: 64px; height: 64px; background: #f5f5f5; border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 10px; border: 1px dashed #ccc;">No Img</div>`;
    }

    nodeWrapper.innerHTML = `
            ${imageHTML}
            <div style="display: flex; flex-direction: column; text-align: left;">
                <div class="node-content" style="font-size: 0.9rem; color: #000000; font-weight: 600;">
                    <span class="node-id" style="font-size: 0.7rem; color: #838383; font-weight: bold; margin-right: 4px;">#${node.Node_ID}</span>
                    ${node.Content}
                </div>
            </div>
        `;

    nodeWrapper.onclick = (e) => {
        e.stopPropagation();
        selectNode(node.Node_ID, nodeWrapper);
    };

    // --- 4. Assembly ---
    // Add Toggle and Node to the Row
    treeRow.appendChild(toggle);
    treeRow.appendChild(nodeWrapper);

    // Add Row to the List Item
    li.appendChild(treeRow);

    // --- 5. Children Logic ---
    if (hasChildren) {
        const ul = document.createElement('ul');
        node.children.forEach(child => ul.appendChild(renderTree(child)));
        li.appendChild(ul);
    }

    return li;
}

/**
 * GLOBAL IMAGE TOGGLE
 * Shows or hides all images in the tree instantly without re-fetching data.
 */
function updateImageVisibility() {
    // 1. Get the checkbox and the tree container
    const checkbox = document.getElementById('imageToggle');
    const container = document.getElementById('tree-container');

    if (!checkbox || !container) return;

    // 2. Toggle the class based on the checkbox state
    if (checkbox.checked) {
        container.classList.remove('hide-images');
    } else {
        container.classList.add('hide-images');
    }
}

/**
 * 4. FORM SUBMISSION
 */
async function addNode() {
    const parentId = document.getElementById('parentId').value;
    const content = document.getElementById('nodeContent').value.trim();
    const phone = document.getElementById('nodePhone').value;
    const description = document.getElementById('nodeDescription').value;
    const fileInput = document.getElementById('nodeImage');

    const errorBox = document.getElementById('form-error');
    const errorText = document.getElementById('error-text');

    // Reset error box
    errorBox.style.display = "none";

    // Validation 1: Name Missing
    if (!content) {
        errorText.innerText = "Please enter a Name for the node.";
        errorBox.style.display = "flex";
        document.getElementById('nodeContent').focus();
        return;
    }

    // Validation 2: Parent Not Selected
    if (!parentId) {
        errorText.innerText = "Select a node in the tree to add this 'Under'.";
        errorBox.style.display = "flex";
        return;
    }

    let base64Image = "";
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 5 * 1024 * 1024) return alert("File too large. Max 5MB allowed.");
        try {
            base64Image = await toBase64(file);
        } catch (err) {
            return alert("Failed to process image file.");
        }
    }

    // Modal Confirmation
    const pathPreview = document.getElementById('hierarchy-path').innerHTML;
    document.getElementById('modal-path-preview').innerHTML = pathPreview;
    document.getElementById('modal-phone-preview').innerText = phone ? `ℹ️  ${phone}` : "";
    document.getElementById('modal-desc-preview').innerText = description ? `📝  ${description}` : "";
    document.querySelector('.modal-details').style.display = (phone || description) ? 'block' : 'none';

    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';

    const confirmed = await new Promise((resolve) => {
        document.getElementById('confirm-yes').onclick = () => { modal.style.display = 'none'; resolve(true); };
        document.getElementById('confirm-no').onclick = () => { modal.style.display = 'none'; resolve(false); };
    });

    if (!confirmed) return;

    const payload = {
        Parent_ID: parentId,
        Content: content,
        Phone: phone,
        Description: description,
        Image_Base64: base64Image
    };

    showToast("📤 Uploading node data...", "success");

    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.status === "success") {
            // 4. REFRESH TREE & NOTIFY
            showToast("Node added successfully!", "success");
            resetAllForms();
            fetchTree();
        } else {
            showToast("Server Error: " + result.message, "error");
        }
    } catch (err) {
        // This combines your custom message with the actual technical error
        showToast(`Submission failed: ${err.message}`, "error");

        // It's also good practice to keep the console log for deep debugging
        console.error("Submission Error:", err);
    }
}

/**
 * UTILITY FUNCTIONS
 */
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

function selectNode(id, nodeElement) {
    // 1. Clear previous selection styles
    document.querySelectorAll('.node-container').forEach(el => {
        el.classList.remove('node-active');
    });

    // 2. Highlight the newly clicked node
    // Check if nodeElement exists to prevent errors if called programmatically
    if (nodeElement) {
        nodeElement.classList.add('node-active');
    }

    // 3. RESTORE THE ARROW OPACITY (The fix)
    const arrow = document.getElementById('parent-arrow-svg');
    if (arrow) {
        arrow.style.opacity = "1";
        // Optional: Add a subtle transition in your CSS for a "fade-in" effect
        arrow.style.transition = "opacity 0.3s ease";
    }

    // 4. Find the node data in your global array
    const selectedNode = allNodesGlobal.find(n => String(n.Node_ID) === String(id));

    if (selectedNode) {

        // 1. IMMEDIATELY HIDE THE PARENT ERROR
        const errorBox = document.getElementById('form-error');
        if (errorBox) errorBox.style.display = "none";

        // Update hidden ID for the addNode() payload
        document.getElementById('parentId').value = id;

            // Check if the image is locked (supports both 1/0 or true/false)
            const isLocked = selectedNode.Is_Image_Locked == 1 || selectedNode.Is_Image_Locked === true;
            const updateTabBtn = document.querySelector('button[onclick*="tab-upload"]');

            if (isLocked) {
                updateTabBtn.style.opacity = "0.5"; // Visual cue it's disabled
                updateTabBtn.style.pointerEvents = "none"; // Prevent clicking
                updateTabBtn.innerHTML = "🔒 Image Locked";
                
                // Auto-switch to Add tab if currently on Update
                if (document.getElementById('tab-upload').classList.contains('active')) {
                    document.querySelector('button[onclick*="tab-add"]').click();
                }
            } else {
                updateTabBtn.style.opacity = "1";
                updateTabBtn.style.pointerEvents = "auto";
                updateTabBtn.innerHTML = "📸 Update Photo";
            }

        // Update the small Parent Label in your Preview Area
        const parentLabel = document.getElementById('parent-name-preview');
        if (parentLabel) {
            parentLabel.innerText = selectedNode.Content;
        }

        // Update the Hierarchy Breadcrumbs
        const hierarchyDisplay = document.getElementById('hierarchy-path');
        if (hierarchyDisplay) {
            const path = getPath(id);
            hierarchyDisplay.innerText = path.join(" > ");
        }

        // Trigger your live path/preview updates
        if (typeof updateLivePath === "function") updateLivePath();
        if (typeof updatePreview === "function") updatePreview();

        // --- TAB 2 UPDATES (Update Image Logic) ---
        // 1. Path
        if (document.getElementById('hierarchy-path-upd')) {
            document.getElementById('hierarchy-path-upd').innerText = "Target: " + getPath(id).join(" > ");
        }
        // 2. Name & Info
        document.getElementById('preview-name-upd').innerText = selectedNode.Content;
        document.getElementById('preview-info-upd').innerText = selectedNode.Phone || "";
        document.getElementById('preview-description-upd').innerText = selectedNode.Description || "";

        // 3. Image Handling for the Preview
        const imgUpd = document.getElementById('preview-image-upd');
        const boxUpd = document.getElementById('preview-image-box-upd');

        if (selectedNode.Image_URL) {
            imgUpd.src = selectedNode.Image_URL;
            imgUpd.style.display = "block";
            boxUpd.style.display = "none";
        } else {
            imgUpd.src = "";
            imgUpd.style.display = "none";
            boxUpd.style.display = "flex";
            boxUpd.innerText = "?";
        }

        // Optional: Scroll the form into view on mobile
            // Inside selectNode(id, nodeElement)

            // 1. Target the common parent container or the tabs header
            // This ensures scrolling works regardless of which tab is active
            const formContainer = document.querySelector('.tabs-header') || document.querySelector('.add-node-form');
            const stickyHeader = document.querySelector('.global-controls');

            if (formContainer) {
                // 2. Dynamic height calculation
                const headerHeight = stickyHeader ? stickyHeader.offsetHeight : 80;
                const offset = headerHeight + 20; // Sticky height + 20px breathing room

                // 3. Precise position calculation
                const elementPosition = formContainer.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - offset;

                // 4. Smooth Scroll
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }

    } else {
        // Safety Reset if something goes wrong
        document.getElementById('parentId').value = "";
        document.getElementById('parent-name-preview').innerText = "None Selected";
    }
}

function getPath(targetId) {
    let path = [];
    let currentId = targetId;
    while (currentId != 0) {
        const node = allNodesGlobal.find(n => String(n.Node_ID) === String(currentId));
        if (node) {
            path.unshift(node.Content);
            currentId = node.Parent_ID;
        } else {
            break;
        }
    }
    return path;
}

function toggleAll(expand) {
    document.querySelectorAll('#tree-container li').forEach(li => {
        const btn = li.querySelector('.toggle-btn');
        const hasUl = li.querySelector('ul');
        if (hasUl && btn) {
            if (expand) {
                li.classList.remove('collapsed');
                btn.innerText = "[-] ";
            } else {
                li.classList.add('collapsed');
                btn.innerText = "[+] ";
            }
        }
    });
}

function updateLivePath() {
    const parentId = document.getElementById('parentId').value;
    const currentInput = document.getElementById('nodeContent').value.trim();
    const pathDisplay = document.getElementById('hierarchy-path');

    if (!parentId) {
        pathDisplay.innerText = "Select a node...";
        return;
    }

    const basePaths = getPath(parentId);
    const basePathString = basePaths.join(" > ");

    if (currentInput.length > 0) {
        pathDisplay.innerHTML = `${basePathString} > <span style="color: #28a745; text-decoration: underline;">${currentInput}</span>`;
    } else {
        pathDisplay.innerText = basePathString;
    }
}

// Updates the Text Preview
function updatePreview() {
    const name = document.getElementById('nodeContent').value || "New Node";
    const info = document.getElementById('nodePhone').value || "Info Preview";
    const desc = document.getElementById('nodeDescription').value;

    // 1. CLEAR THE ERROR (Hide the box and reset border)
    const errorBox = document.getElementById('form-error');
    if (errorBox) errorBox.style.display = "none";
    document.getElementById('nodeContent').style.borderColor = "#ccc";

    document.getElementById('preview-name').innerText = name;
    document.getElementById('preview-info').innerText = info;

    // Update the blue description area
    const descPreview = document.getElementById('preview-description');
    descPreview.innerText = desc;

    // Optional: Hide the description div if empty to save space
    descPreview.style.display = desc ? "block" : "none";

    if (typeof updateLivePath === "function") updateLivePath();
}

// Updates the Image Preview
function previewFile() {
    const previewImg = document.getElementById('preview-image');
    const placeholder = document.getElementById('preview-image-box');
    const file = document.getElementById('nodeImage').files[0];
    const reader = new FileReader();

    reader.onloadend = function () {
        previewImg.src = reader.result;
        previewImg.style.display = "block";
        placeholder.style.display = "none";
    }

    if (file) {
        reader.readAsDataURL(file);
    } else {
        previewImg.src = "";
        previewImg.style.display = "none";
        placeholder.style.display = "flex";
    }
}

function previewFileUpdate() {
    const file = document.getElementById('nodeImage-upd').files[0];
    const preview = document.getElementById('preview-image-upd');
    const box = document.getElementById('preview-image-box-upd');

    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.style.display = "block";
            box.style.display = "none";
        }
        reader.readAsDataURL(file);
    }
}

function showToast(message, type = "success") {
    const container = document.getElementById('toast-container');
    if (!container) return; // Safety check

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;

    // Icons based on type
    const icon = type === "success" ? "✅" : "❌";
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;

    container.appendChild(toast);

    // Auto-remove logic
    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function openTab(evt, tabId) {
    // 1. Hide all tab content
    const contents = document.getElementsByClassName("tab-content");
    for (let content of contents) {
        content.classList.remove("active");
    }

    // 2. Remove "active" class from all buttons
    const buttons = document.getElementsByClassName("tab-btn");
    for (let btn of buttons) {
        btn.classList.remove("active");
    }

    // 3. Show the current tab and add active class to the button
    document.getElementById(tabId).classList.add("active");
    evt.currentTarget.classList.add("active");
}

async function handleImageUpdate() {
    const targetId = document.getElementById('parentId').value; // Get selected ID
    const fileInput = document.getElementById('nodeImage-upd');

    if (!targetId) return showToast("Please select a node from the tree first.", "error");
    if (fileInput.files.length === 0) return showToast("Please select an image file.", "error");

    const file = fileInput.files[0];
    if (file.size > 5 * 1024 * 1024) return showToast("File too large (Max 5MB).", "error");

    showToast("Uploading Photo...", "success"); // Visual feedback

    try {
        const base64 = await toBase64(file);

        const payload = {
            action: "updateImage",
            Node_ID: targetId,
            Image_Base64: base64
        };

        const response = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === "success") {
            showToast("✅ Photo replaced successfully!", "success");
            // 6. Refresh the Tree UI
            resetAllForms();
            fetchTree();
        } else {
            showToast("Update failed: " + result.message, "error");
        }
    } catch (err) {
        showToast("Error: " + err.message, "error");
    }
}


function resetAllForms() {
    // --- 1. RESET "ADD NODE" FORM & PREVIEW ---
    const addFields = ['nodeContent', 'nodePhone', 'nodeDescription', 'nodeImage', 'parentId'];
    addFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // Add Node Preview Elements
    const prevImg = document.getElementById('preview-image');
    if (prevImg) {
        prevImg.src = "";
        prevImg.style.display = "none";
    }

    const prevName = document.getElementById('preview-name');
    if (prevName) prevName.innerText = "New Node Name";

    const prevInfo = document.getElementById('preview-info');
    if (prevInfo) prevInfo.innerText = "";

    const prevDesc = document.getElementById('preview-description');
    if (prevDesc) {
        prevDesc.innerText = "";
        prevDesc.style.display = "none";
    }

    // Add Node Selection UI
    const parentLabel = document.getElementById('parent-name-preview');
    if (parentLabel) parentLabel.innerText = "None Selected";

    const arrow = document.getElementById('parent-arrow-svg');
    if (arrow) arrow.style.opacity = "0";

    const pathDisplay = document.getElementById('hierarchy-path');
    if (pathDisplay) pathDisplay.innerText = "Select a node...";


    // --- 2. RESET "UPDATE IMAGE" SECTION ---
    const pathUpd = document.getElementById('hierarchy-path-upd');
    if (pathUpd) pathUpd.innerText = "Select a node to update...";

    const previewImgUpd = document.getElementById('preview-image-upd');
    const previewBoxUpd = document.getElementById('preview-image-box-upd');
    if (previewImgUpd) {
        previewImgUpd.src = "";
        previewImgUpd.style.display = "none";
    }
    if (previewBoxUpd) previewBoxUpd.style.display = "flex";

    const updTexts = {
        'preview-name-upd': 'Select Node',
        'preview-info-upd': 'Current Info',
        'preview-description-upd': ''
    };
    for (let id in updTexts) {
        const el = document.getElementById(id);
        if (el) el.innerText = updTexts[id];
    }

    const fileUpd = document.getElementById('nodeImage-upd');
    if (fileUpd) fileUpd.value = "";


    // --- 3. GLOBAL STATE RESET ---
    selectedNode = null; 
    
    console.log("UI and Forms have been fully reset.");
}
