// ======================
// 6.1 — GLOBAL VARIABLES
// ======================

// All nodes will live in this object: { id → nodeData }
let nodes = {};

// “Which node was most recently added?” (for drawing the arrow chain)
let lastAddedId = null;

// Next integer ID to assign
let nextNodeId = 1;

// Which node is currently clicked/selected
let selectedNodeId = null;

// Reference to the <svg> element
const svg = document.getElementById("canvas");

// Padding so that parents fully enclose their children
const PARENT_PADDING = 20;

// Rough approximation for text‐width (8px per character)
const CHAR_WIDTH = 8;

// Fixed label height
const LABEL_HEIGHT = 20;

// Vertical gap between circle top and label background
const LABEL_GAP = 5;

// Default radius for brand‐new standalone nodes
const DEFAULT_RADIUS = 40;


// ==============================
// 6.2 — INITIALIZATION on LOAD
// ==============================

window.addEventListener("DOMContentLoaded", () => {
  // 1) Load saved state if it exists
  loadFromLocalStorage();

  // 2) Wire up the four buttons
  document.getElementById("add-node").addEventListener("click", onAddNewNode);
  document.getElementById("add-child").addEventListener("click", onAddChild);
  document.getElementById("add-parent").addEventListener("click", onAddParent);
  document.getElementById("reset-map").addEventListener("click", onResetMap);

  // 3) Define the arrowhead marker inside <defs> (only once)
  defineArrowheadMarker();

  // 4) Render everything (so that if localStorage had saved nodes, they show up)
  renderAll();
});


// =================================================
// 6.3 — LOCAL STORAGE: SAVE & LOAD DATA PERSISTENCE
// =================================================

function saveToLocalStorage() {
  localStorage.setItem("mindmap-nodes", JSON.stringify(nodes));
  localStorage.setItem("mindmap-lastAddedId", JSON.stringify(lastAddedId));
  localStorage.setItem("mindmap-nextNodeId", JSON.stringify(nextNodeId));
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem("mindmap-nodes");
  if (saved) {
    nodes = JSON.parse(saved);
    lastAddedId = JSON.parse(localStorage.getItem("mindmap-lastAddedId"));
    nextNodeId = JSON.parse(localStorage.getItem("mindmap-nextNodeId"));
  } else {
    nodes = {};
    lastAddedId = null;
    nextNodeId = 1;
  }
}



// ==========================================
// 6.4 — BUTTON CALLBACK (“Add New Node”)
// ==========================================

function onAddNewNode() {
  const label = prompt("Enter label for new node:");
  if (!label) return; // if user canceled or left blank

  // Compute center of SVG in SVG coordinate system:
  const bbox = svg.getBoundingClientRect();
  const midXpx = bbox.width / 2;
  const midYpx = bbox.height / 2;
  const pt = svg.createSVGPoint();
  pt.x = midXpx;
  pt.y = midYpx;
  const svgMid = pt.matrixTransform(svg.getScreenCTM().inverse());

  const id = nextNodeId++;
  const predecessor = lastAddedId;

  // Create a brand-new node with no parent/children
  nodes[id] = {
    id,
    label,
    x: svgMid.x,
    y: svgMid.y,
    radius: DEFAULT_RADIUS,
    parent: null,
    children: [],
    predecessor: predecessor
  };

  lastAddedId = id;
  saveToLocalStorage();
  renderAll();
}



// =====================================
// 6.5 — BUTTON CALLBACK (“Add Child”)
// =====================================

function onAddChild() {
  if (!selectedNodeId) {
    alert("Please click on an existing node first to select it.");
    return;
  }
  const parentId = selectedNodeId;
  const label = prompt("Enter label for new child node:");
  if (!label) return;

  const id = nextNodeId++;
  const predecessor = lastAddedId;

  // Start child exactly at parent center (so you can drag it out)
  const x = nodes[parentId].x;
  const y = nodes[parentId].y;
  const radius = DEFAULT_RADIUS / 1.2;

  nodes[id] = {
    id,
    label,
    x,
    y,
    radius,
    parent: parentId,
    children: [],
    predecessor: predecessor
  };

  // Update parent's children array
  nodes[parentId].children.push(id);

  lastAddedId = id;
  updateAncestors(id);
  saveToLocalStorage();
  renderAll();
}



// =======================================
// 6.6 — BUTTON CALLBACK (“Add Parent”)
// =======================================

function onAddParent() {
  if (!selectedNodeId) {
    alert("Please click on an existing node first to select it.");
    return;
  }
  const childId = selectedNodeId;
  const label = prompt("Enter label for the new parent node:");
  if (!label) return;

  const id = nextNodeId++;
  const predecessor = lastAddedId;
  const oldParent = nodes[childId].parent;

  // Create the new parent object in between
  nodes[id] = {
    id,
    label,
    x: nodes[childId].x,
    y: nodes[childId].y,
    radius: DEFAULT_RADIUS,
    parent: oldParent,
    children: [childId],
    predecessor: predecessor
  };

  // Rewire the child to point to the new parent
  nodes[childId].parent = id;

  // If the child had an old parent, replace that child in its children array
  if (oldParent !== null) {
    const siblings = nodes[oldParent].children;
    const idx = siblings.indexOf(childId);
    if (idx !== -1) siblings.splice(idx, 1, id);
  }

  // Auto-resize this new parent to fit its single child
  resizeParentToFitChildren(id);

  lastAddedId = id;
  updateAncestors(id);
  saveToLocalStorage();
  renderAll();
}



// ==============================================
// 6.7 — BUTTON CALLBACK (“Reset Map” → clears all)
// ==============================================

function onResetMap() {
  if (
    confirm("This will erase everything and reset your mind-map. Continue?")
  ) {
    localStorage.removeItem("mindmap-nodes");
    localStorage.removeItem("mindmap-lastAddedId");
    localStorage.removeItem("mindmap-nextNodeId");
    nodes = {};
    lastAddedId = null;
    nextNodeId = 1;
    selectedNodeId = null;
    renderAll();
  }
}



// ===================================================
// 6.8 — UTILITY: Define the arrowhead marker in <defs>
// ===================================================

function defineArrowheadMarker() {
  // If we already inserted <defs> once, skip it
  if (svg.querySelector("defs")) return;

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  svg.appendChild(defs);

  const marker = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "marker"
  );
  marker.setAttribute("id", "arrowhead");
  marker.setAttribute("markerWidth", "10");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("refX", "10");
  marker.setAttribute("refY", "3.5");
  marker.setAttribute("orient", "auto");
  marker.setAttribute("markerUnits", "strokeWidth");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M0,0 L10,3.5 L0,7 Z");
  path.setAttribute("class", "arrow-marker");
  marker.appendChild(path);
  defs.appendChild(marker);
}



// =============================================
// 6.9 — MAIN RENDER LOOP: draw arrows + draw nodes
// =============================================

function renderAll() {
  // 1) Clear any existing children in <svg>
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  // 2) Re-add our <defs> for arrowheads
  defineArrowheadMarker();

  // 3) Draw arrows behind all nodes
  for (const id in nodes) {
    const node = nodes[id];
    if (node.predecessor !== null && nodes[node.predecessor]) {
      drawArrowBetween(nodes[node.predecessor], node);
    }
  }

  // 4) Draw every node on top
  for (const id in nodes) {
    drawNode(nodes[id]);
  }
}



// ==================================================
// 6.10 — DRAWING AN ARROW Between two nodes’ labels
// ==================================================

function drawArrowBetween(nodeA, nodeB) {
  // Compute label rectangles for each node
  const rectA = computeLabelRect(nodeA);
  const rectB = computeLabelRect(nodeB);

  // From center of rectA to center of rectB
  const fromX = rectA.x + rectA.width / 2;
  const fromY = rectA.y + rectA.height / 2;
  const toX = rectB.x + rectB.width / 2;
  const toY = rectB.y + rectB.height / 2;

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", fromX);
  line.setAttribute("y1", fromY);
  line.setAttribute("x2", toX);
  line.setAttribute("y2", toY);
  line.setAttribute("class", "arrow-line");
  svg.appendChild(line);
}



// =================================================
// 6.11 — DRAW A SINGLE NODE (circle + label + events)
// =================================================

function drawNode(node) {
  // 1) Wrap circle + label in a <g> so dragging either moves both
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("data-node-id", node.id);

  // 2) Draw the circle (transparent fill, stroked)
  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  circle.setAttribute("cx", node.x);
  circle.setAttribute("cy", node.y);
  circle.setAttribute("r", node.radius);
  circle.setAttribute("class", "node-circle");
  if (node.id === selectedNodeId) {
    circle.classList.add("selected");
  }
  g.appendChild(circle);

  // 3) Compute label rectangle metrics
  const { x: rectX, y: rectY, width: rectW, height: rectH } =
    computeLabelRect(node);

  // 4) Draw the white rectangle behind the text
  const rect = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect"
  );
  rect.setAttribute("x", rectX);
  rect.setAttribute("y", rectY);
  rect.setAttribute("width", rectW);
  rect.setAttribute("height", rectH);
  rect.setAttribute("class", "node-label-rect");
  g.appendChild(rect);

  // 5) Draw the text, centered horizontally + vertically
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", node.x);
  text.setAttribute("y", rectY + rectH / 2);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
  text.setAttribute("class", "node-label-text");
  text.textContent = node.label;
  g.appendChild(text);

  // 6) Wire up click & mousedown events on the group:
  //    - click to select/deselect
  //    - mousedown → start dragging
  g.addEventListener("click", (e) => {
    e.stopPropagation();
    selectNode(node.id);
  });
  g.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    startDrag(e, node.id);
  });

  // 7) Add this <g> into our main SVG
  svg.appendChild(g);
}



// ============================================================
// 6.12 — COMPUTE LABEL RECT Position/Size (approx. from nodeData)
// ============================================================

function computeLabelRect(node) {
  const textLength = node.label.length;
  const width = textLength * CHAR_WIDTH + 20; // 20px horizontal padding
  const height = LABEL_HEIGHT; // fixed
  const x = node.x - width / 2;
  const y = node.y - node.radius - height - LABEL_GAP;
  return { x, y, width, height };
}



// ===================================================
// 6.13 — NODE SELECTION (highlight border in orange)
// ===================================================

function selectNode(id) {
  if (selectedNodeId === id) {
    selectedNodeId = null; // toggle off if already selected
  } else {
    selectedNodeId = id;
  }
  renderAll();
}



// =================================================
// 6.14 — DRAGGING LOGIC (vanilla mouse events)
// =================================================

let dragNodeId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

function startDrag(e, nodeId) {
  dragNodeId = nodeId;
  const node = nodes[nodeId];

  // Find where the mouse is in SVG coordinates
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());

  // Store offset so circle doesn’t “jump” under your cursor
  dragOffsetX = cursor.x - node.x;
  dragOffsetY = cursor.y - node.y;

  window.addEventListener("mousemove", onDrag);
  window.addEventListener("mouseup", endDrag);
}

function onDrag(e) {
  if (dragNodeId === null) return;
  const node = nodes[dragNodeId];

  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());

  // Update node’s center
  node.x = cursor.x - dragOffsetX;
  node.y = cursor.y - dragOffsetY;

  // Every time we move, ancestors need to resize to keep children inside
  updateAncestors(dragNodeId);

  renderAll();
}

function endDrag(e) {
  if (dragNodeId !== null) {
    saveToLocalStorage();
  }
  dragNodeId = null;
  window.removeEventListener("mousemove", onDrag);
  window.removeEventListener("mouseup", endDrag);
}



// =============================================
// 6.15 — RECURSIVELY UPDATE PARENTS to fit children
// =============================================

function updateAncestors(childId) {
  let current = nodes[childId].parent;
  while (current !== null) {
    resizeParentToFitChildren(current);
    current = nodes[current].parent;
  }
}

function resizeParentToFitChildren(parentId) {
  const parent = nodes[parentId];
  if (!parent || parent.children.length === 0) return;

  // Build a bounding box around all child circles
  const childBoxes = parent.children.map((cid) => {
    const c = nodes[cid];
    return {
      minX: c.x - c.radius,
