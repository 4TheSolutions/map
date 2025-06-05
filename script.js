// ======================
// 6.1 — GLOBAL VARIABLES
// ======================

let nodes = {};
let lastAddedId = null;
let nextNodeId = 1;
let selectedNodeId = null;
const svg = document.getElementById("canvas");
const PARENT_PADDING = 20;
const CHAR_WIDTH = 8;
const LABEL_HEIGHT = 20;
const LABEL_GAP = 5;
const DEFAULT_RADIUS = 40;

// ==============================
// 6.2 — INITIALIZATION on LOAD
// ==============================

window.addEventListener("DOMContentLoaded", () => {
  loadFromLocalStorage();
  document.getElementById("add-child").addEventListener("click", onAddChild);
  document.getElementById("add-parent").addEventListener("click", onAddParent);
  document.getElementById("reset-map").addEventListener("click", onResetMap);
  defineArrowheadMarker();
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
  const savedNodes = localStorage.getItem("mindmap-nodes");
  if (savedNodes) {
    nodes = JSON.parse(savedNodes);
    lastAddedId = JSON.parse(localStorage.getItem("mindmap-lastAddedId"));
    nextNodeId = JSON.parse(localStorage.getItem("mindmap-nextNodeId"));
  } else {
    nodes = {};
    lastAddedId = null;
    nextNodeId = 1;
  }
}

// =====================================
// 6.4 — BUTTON CALLBACKS (“Add Child”)
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
    predecessor,
  };

  nodes[parentId].children.push(id);
  lastAddedId = id;
  updateAncestors(id);
  saveToLocalStorage();
  renderAll();
}

// =======================================
// 6.5 — BUTTON CALLBACKS (“Add Parent”)
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

  nodes[id] = {
    id,
    label,
    x: nodes[childId].x,
    y: nodes[childId].y,
    radius: DEFAULT_RADIUS,
    parent: oldParent,
    children: [childId],
    predecessor,
  };

  nodes[childId].parent = id;

  if (oldParent !== null) {
    const siblings = nodes[oldParent].children;
    const idx = siblings.indexOf(childId);
    if (idx !== -1) siblings.splice(idx, 1, id);
  }

  resizeParentToFitChildren(id);
  lastAddedId = id;
  updateAncestors(id);
  saveToLocalStorage();
  renderAll();
}

// ==============================================
// 6.6 — BUTTON CALLBACK (“Reset Map” → clears all)
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
// 6.7 — UTILITY: Define the arrowhead marker in <defs>
// ===================================================

function defineArrowheadMarker() {
  const existingDefs = svg.querySelector("defs");
  if (existingDefs) return;

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
// 6.8 — MAIN RENDER LOOP: draw arrows + draw nodes
// =============================================

function renderAll() {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  defineArrowheadMarker();

  for (const id in nodes) {
    const node = nodes[id];
    if (node.predecessor !== null && nodes[node.predecessor]) {
      drawArrowBetween(nodes[node.predecessor], node);
    }
  }

  for (const id in nodes) {
    drawNode(nodes[id]);
  }
}

// ==================================================
// 6.9 — DRAWING AN ARROW Between two nodes’ labels
// ==================================================

function drawArrowBetween(nodeA, nodeB) {
  const rectA = computeLabelRect(nodeA);
  const rectB = computeLabelRect(nodeB);

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
// 6.10 — DRAW A SINGLE NODE (circle + label + events)
// =================================================

function drawNode(node) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("data-node-id", node.id);

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

  const { x: rectX, y: rectY, width: rectW, height: rectH } =
    computeLabelRect(node);

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", rectX);
  rect.setAttribute("y", rectY);
  rect.setAttribute("width", rectW);
  rect.setAttribute("height", rectH);
  rect.setAttribute("class", "node-label-rect");
  g.appendChild(rect);

  const text = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text"
  );
  text.setAttribute("x", node.x);
  text.setAttribute("y", rectY + rectH / 2);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
  text.setAttribute("class", "node-label-text");
  text.textContent = node.label;
  g.appendChild(text);

  g.addEventListener("click", (e) => {
    e.stopPropagation();
    selectNode(node.id);
  });
  g.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    startDrag(e, node.id);
  });

  svg.appendChild(g);
}

// ============================================================
// 6.11 — COMPUTE LABEL RECT Position/Size (approx. from nodeData)
// ============================================================

function computeLabelRect(node) {
  const textLength = node.label.length;
  const width = textLength * CHAR_WIDTH + 20;
  const height = LABEL_HEIGHT;
  const x = node.x - width / 2;
  const y = node.y - node.radius - height - LABEL_GAP;
  return { x, y, width, height };
}

// ===================================================
// 6.12 — NODE SELECTION (highlight border in orange)
// ===================================================

function selectNode(id) {
  if (selectedNodeId === id) selectedNodeId = null;
  else selectedNodeId = id;
  renderAll();
}

// ================================================
// 6.13 — DRAGGING LOGIC (vanilla mouse events)
// ================================================

let dragNodeId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

function startDrag(e, nodeId) {
  dragNodeId = nodeId;
  const node = nodes[nodeId];
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());
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
  node.x = cursor.x - dragOffsetX;
  node.y = cursor.y - dragOffsetY;
  updateAncestors(dragNodeId);
  renderAll();
}

function endDrag(e) {
  if (dragNodeId !== null) saveToLocalStorage();
  dragNodeId = null;
  window.removeEventListener("mousemove", onDrag);
  window.removeEventListener("mouseup", endDrag);
}

// ===============================================
// 6.14 — RECURSIVELY UPDATE PARENTS to fit children
// ===============================================

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

  const childBoxes = parent.children.map((cid) => {
    const c = nodes[cid];
    return {
      minX: c.x - c.radius,
      maxX: c.x + c.radius,
      minY: c.y - c.radius,
      maxY: c.y + c.radius,
    };
  });

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  childBoxes.forEach((b) => {
    if (b.minX < minX) minX = b.minX;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxY > maxY) maxY = b.maxY;
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const halfWidth = (maxX - minX) / 2;
  const halfHeight = (maxY - minY) / 2;
  const required = Math.max(halfWidth, halfHeight);

  parent.x = centerX;
  parent.y = centerY;
  parent.radius = required + PARENT_PADDING;
}
