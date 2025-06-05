// =================================
// 3.1 — GLOBAL VARIABLES & SETTINGS
// =================================

// Our full set of nodes: { id: { id, label, x, y, radius, parent, children, predecessor } }
let nodes = {};

// Track the last‐added node’s ID (for drawing arrows)
let lastAddedId = null;

// Next ID to assign to a newly created node
let nextNodeId = 1;

// Currently selected node (null if none)
let selectedNodeId = null;

// Reference to our main <svg> element
let svg = null;

// Constants for layout / appearance:
const DEFAULT_RADIUS = 40;    // Default radius of a “fresh” node
const OFFSET_STEP = 60;       // How far a new node is offset from the last one
const PARENT_PADDING = 20;    // Extra padding so parents enclose children
const CHAR_WIDTH = 8;         // Approx. px per character for label width
const LABEL_HEIGHT = 20;      // Label rectangle height
const LABEL_GAP = 5;          // Gap between circle top and label


// =================================
// 3.2 — INITIALIZATION on DOMContentLoaded
// =================================

window.addEventListener("DOMContentLoaded", () => {
  // 1) Grab the <svg> element
  svg = document.getElementById("canvas");

  // 2) Load saved state (if any) from localStorage
  loadFromLocalStorage();

  // 3) Hook up the four buttons by ID
  document.getElementById("add-node").addEventListener("click", onAddNewNode);
  document.getElementById("add-child").addEventListener("click", onAddChild);
  document.getElementById("add-parent").addEventListener("click", onAddParent);
  document.getElementById("reset-map").addEventListener("click", onResetMap);

  // 4) Define the arrowhead marker just once
  defineArrowheadMarker();

  // 5) Initial render (draw any pre‐saved nodes)
  renderAll();
});


// =================================
// 3.3 — LOCAL STORAGE: SAVE & LOAD
// =================================

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


// ==============================================
// 3.4 — BUTTON HANDLER: Add a BRAND‐NEW (ROOT) Node
// ==============================================

function onAddNewNode() {
  const label = prompt("Enter a label for this new node:");
  if (!label) return; // user canceled or empty

  // Decide where to place the new node:
  // If there’s a previously added node, offset by OFFSET_STEP in both x and y.
  // Otherwise, place at a default (150, 150).
  let x, y;
  if (lastAddedId !== null && nodes[lastAddedId]) {
    const prev = nodes[lastAddedId];
    x = prev.x + OFFSET_STEP;
    y = prev.y + OFFSET_STEP;
  } else {
    // First node (or if lastAddedId got removed somehow)
    x = 150;
    y = 150;
  }

  // Create the new node object
  const id = nextNodeId++;
  const predecessor = lastAddedId; // for drawing the arrow

  nodes[id] = {
    id,
    label,
    x,
    y,
    radius: DEFAULT_RADIUS,
    parent: null,
    children: [],
    predecessor: predecessor
  };

  lastAddedId = id;
  saveToLocalStorage();
  renderAll();
}


// ====================================
// 3.5 — BUTTON HANDLER: Add Child Node
// ====================================

function onAddChild() {
  if (!selectedNodeId) {
    alert("Please click an existing node first to select it.");
    return;
  }

  const parentId = selectedNodeId;
  const label = prompt("Enter a label for the new child node:");
  if (!label) return;

  // Create the child at the parent’s center (so you can drag it out after)
  const parent = nodes[parentId];
  const x = parent.x;
  const y = parent.y;
  const radius = DEFAULT_RADIUS / 1.2; // slightly smaller

  const id = nextNodeId++;
  const predecessor = lastAddedId;

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

  // Add child reference to parent
  parent.children.push(id);

  lastAddedId = id;
  updateAncestors(id);
  saveToLocalStorage();
  renderAll();
}


// =====================================
// 3.6 — BUTTON HANDLER: Add Parent Node
// =====================================

function onAddParent() {
  if (!selectedNodeId) {
    alert("Please click an existing node first to select it.");
    return;
  }

  const childId = selectedNodeId;
  const label = prompt("Enter a label for the new parent node:");
  if (!label) return;

  const id = nextNodeId++;
  const predecessor = lastAddedId;
  const oldParent = nodes[childId].parent;

  // Create the new parent in between
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

  // If there was an old parent, replace childId with id in its children array
  if (oldParent !== null) {
    const siblings = nodes[oldParent].children;
    const idx = siblings.indexOf(childId);
    if (idx !== -1) {
      siblings.splice(idx, 1, id);
    }
  }

  // Auto‐resize the new parent so it encloses its child
  resizeParentToFitChildren(id);

  lastAddedId = id;
  updateAncestors(id);
  saveToLocalStorage();
  renderAll();
}


// ================================================
// 3.7 — BUTTON HANDLER: Reset Map (clear everything)
// ================================================

function onResetMap() {
  if (
    confirm("This will erase your entire map. Are you sure?")
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


// ====================================================
// 3.8 — Define the Arrowhead Marker inside <defs> once
// ====================================================

function defineArrowheadMarker() {
  // If we already added a <defs> section, skip adding again
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


// ===============================================
// 3.9 — MAIN RENDER LOOP: draw arrows then draw nodes
// ===============================================

function renderAll() {
  // 1) Clear out existing SVG contents
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  // 2) Re‐insert arrowhead <defs>
  defineArrowheadMarker();

  // 3) Draw arrows behind everything
  for (const id in nodes) {
    const node = nodes[id];
    if (node.predecessor !== null && nodes[node.predecessor]) {
      drawArrowBetween(nodes[node.predecessor], node);
    }
  }

  // 4) Draw each node on top
  for (const id in nodes) {
    drawNode(nodes[id]);
  }
}


// =====================================================
// 3.10 — DRAW AN ARROW Between two nodes’ label rectangles
// =====================================================

function drawArrowBetween(nodeA, nodeB) {
  // Compute each node’s label rectangle
  const rectA = computeLabelRect(nodeA);
  const rectB = computeLabelRect(nodeB);

  // Arrow from center of rectA to center of rectB
  const fromX = rectA.x + rectA.width / 2;
  const fromY = rectA.y + rectA.height / 2;
  const toX = rectB.x + rectB.width / 2;
  const toY = rectB.y + rectB.height / 2;

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", fromX);
