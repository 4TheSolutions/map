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
const DEFAULT_RADIUS = 40;      // Default radius of a new node
const OFFSET_STEP = 60;         // Offset for successive root nodes
const PARENT_PADDING = 20;      // Extra padding so parents enclose children
const CHAR_WIDTH = 8;           // Approx. px per character for label width
const LABEL_HEIGHT = 20;        // Label rectangle height
const LABEL_GAP = 5;            // Gap between circle top and label
const SIZE_STEP = 10;           // Amount (px) to increase/decrease radius



// =================================
// 3.2 — INITIALIZATION on load
// =================================

window.addEventListener("DOMContentLoaded", () => {
  // 1) Grab the <svg> element
  svg = document.getElementById("canvas");

  // 2) Load saved state if present
  loadFromLocalStorage();

  // 3) Hook up all buttons by ID
  document.getElementById("add-node").addEventListener("click", onAddNewNode);
  document.getElementById("add-child").addEventListener("click", onAddChild);
  document.getElementById("add-parent").addEventListener("click", onAddParent);
  document.getElementById("delete-node").addEventListener("click", onDeleteNode);
  document.getElementById("increase-size").addEventListener("click", onIncreaseSize);
  document.getElementById("decrease-size").addEventListener("click", onDecreaseSize);
  document.getElementById("reset-map").addEventListener("click", onResetMap);

  // 4) Define the arrowhead marker once
  defineArrowheadMarker();

  // 5) Render everything (so that any saved nodes appear)
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
// 3.4 — BUTTON HANDLER: Add a BRAND-NEW (ROOT) Node
// ==============================================

function onAddNewNode() {
  const label = prompt("Enter a label for this new node:");
  if (!label) return;

  // Determine placement:
  let x, y;
  if (lastAddedId !== null && nodes[lastAddedId]) {
    // Offset from the last-added node
    const prev = nodes[lastAddedId];
    x = prev.x + OFFSET_STEP;
    y = prev.y + OFFSET_STEP;
  } else {
    // First node on a blank map
    x = 150;
    y = 150;
  }

  const id = nextNodeId++;
  const predecessor = lastAddedId;

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

  const parent = nodes[parentId];
  const x = parent.x;
  const y = parent.y;
  const radius = DEFAULT_RADIUS / 1.2;

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

  // Create new parent between oldParent and child
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

  // Rewire child to point to new parent
  nodes[childId].parent = id;

  // If an old parent existed, replace child with new parent in its children list
  if (oldParent !== null) {
    const siblings = nodes[oldParent].children;
    const idx = siblings.indexOf(childId);
    if (idx !== -1) {
      siblings.splice(idx, 1, id);
    }
  }

  // Auto‐resize new parent so it fully encloses child
  resizeParentToFitChildren(id);

  lastAddedId = id;
  updateAncestors(id);
  saveToLocalStorage();
  renderAll();
}


// ============================================
// 3.7 — BUTTON HANDLER: Delete Selected Node
// ============================================

function onDeleteNode() {
  if (!selectedNodeId) {
    alert("Please click a node to select it before deleting.");
    return;
  }

  const toDelete = collectSubtree(selectedNodeId);

  // If the deleted node had a parent, remove it from parent's children
  const parentId = nodes[selectedNodeId].parent;
  if (parentId !== null && nodes[parentId]) {
    const arr = nodes[parentId].children;
    const idx = arr.indexOf(selectedNodeId);
    if (idx !== -1) arr.splice(idx, 1);
  }

  // Delete all nodes in the subtree
  toDelete.forEach((nid) => {
    delete nodes[nid];
  });

  // If lastAddedId was deleted, clear it
  if (toDelete.includes(lastAddedId)) {
    lastAddedId = null;
  }

  // Clear selection if it was deleted
  selectedNodeId = null;

  saveToLocalStorage();
  renderAll();
}

// Recursively collect a node + all its descendants
function collectSubtree(rootId) {
  let result = [rootId];
  const children = nodes[rootId].children;
  children.forEach((cid) => {
    result = result.concat(collectSubtree(cid));
  });
  return result;
}


// ================================================
// 3.8 — BUTTON HANDLER: Increase Selected Node’s Size
// ================================================

function onIncreaseSize() {
  if (!selectedNodeId) {
    alert("Please click a node to select it, then click Increase Size.");
    return;
  }

  const node = nodes[selectedNodeId];
  const newRadius = node.radius + SIZE_STEP;
  node.radius = newRadius;

  // After manually resizing, ancestors may need to expand
  updateAncestors(selectedNodeId);

  saveToLocalStorage();
  renderAll();
}


// ================================================
// 3.9 — BUTTON HANDLER: Decrease Selected Node’s Size
// (but never below what’s needed to enclose children)
// ================================================

function onDecreaseSize() {
  if (!selectedNodeId) {
    alert("Please click a node to select it, then click Decrease Size.");
    return;
  }

  const node = nodes[selectedNodeId];
  let newRadius = node.radius - SIZE_STEP;
  if (newRadius < 10) newRadius = 10; // absolute minimum

  // If the node has children, compute the minimal radius so it still contains them
  if (node.children.length > 0) {
    // Compute bounding box of child circles
    const boxes = node.children.map((cid) => {
      const c = nodes[cid];
      return {
        minX: c.x - c.radius,
        maxX: c.x + c.radius,
        minY: c.y - c.radius,
        maxY: c.y + c.radius
      };
    });
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    boxes.forEach((b) => {
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxY > maxY) maxY = b.maxY;
    });

    // Center of child bounding box
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    // Required radius to cover children
    const halfWidth = (maxX - minX) / 2;
    const halfHeight = (maxY - minY) / 2;
    const required = Math.max(halfWidth, halfHeight);
    const minimal = required + PARENT_PADDING;

    if (newRadius < minimal) {
      newRadius = minimal;
    }

    // Re‐center the parent on its children
    node.x = centerX;
    node.y = centerY;
  }

  node.radius = newRadius;

  // After shrinking, ancestors might need to shrink (or might not)
  updateAncestors(selectedNodeId);

  saveToLocalStorage();
  renderAll();
}


// ====================================================
// 3.10 — BUTTON HANDLER: Reset Map (clear everything)
// ====================================================

function onResetMap() {
  if (confirm("This will erase your entire map. Continue?")) {
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
// 3.11 — Define the Arrowhead Marker inside <defs>
// ====================================================

function defineArrowheadMarker() {
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


// ================================================
// 3.12 — MAIN RENDER LOOP: draw arrows then nodes
// ================================================

function renderAll() {
  // 1) Clear out existing children of <svg>
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  // 2) Re‐insert arrowhead <defs>
  defineArrowheadMarker();

  // 3) Draw arrows behind all nodes
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
// 3.13 — DRAW AN ARROW Between two nodes’ label rectangles
// =====================================================

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


// ==================================================
// 3.14 — DRAW A SINGLE NODE (circle + label + events)
// ==================================================

function drawNode(node) {
  // Create a <g> so circle & label move together
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("data-node-id", node.id);

  // 1) Draw the circle
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

  // 2) Compute label rectangle metrics
  const { x: rectX, y: rectY, width: rectW, height: rectH } =
    computeLabelRect(node);

  // 3) Draw label background
  const rectBG = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rectBG.setAttribute("x", rectX);
  rectBG.setAttribute("y", rectY);
  rectBG.setAttribute("width", rectW);
  rectBG.setAttribute("height", rectH);
  rectBG.setAttribute("class", "node-label-rect");
  g.appendChild(rectBG);

  // 4) Draw label text, centered
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", node.x);
  text.setAttribute("y", rectY + rectH / 2);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
  text.setAttribute("class", "node-label-text");
  text.textContent = node.label;
  g.appendChild(text);

  // 5) Clicking this <g> selects/deselects the node
  g.addEventListener("click", (e) => {
    e.stopPropagation();
    selectNode(node.id);
  });

  // 6) Mousedown on <g> begins dragging
  g.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    startDrag(e, node.id);
  });

  svg.appendChild(g);
}


// =======================================================
// 3.15 — COMPUTE LABEL RECT (size & position) for a node
// =======================================================

function computeLabelRect(node) {
  const textLen = node.label.length;
  const width = textLen * CHAR_WIDTH + 20; // 20px horizontal padding
  const height = LABEL_HEIGHT;              // fixed height
  const x = node.x - width / 2;
  const y = node.y - node.radius - height - LABEL_GAP;
  return { x, y, width, height };
}


// ================================================
// 3.16 — NODE SELECTION: highlight / unhighlight
// ================================================

function selectNode(id) {
  if (selectedNodeId === id) {
    selectedNodeId = null; // toggle off
  } else {
    selectedNodeId = id;
  }
  renderAll();
}


// ================================================
// 3.17 — DRAGGING LOGIC (vanilla mouse events)
// ================================================

let dragNodeId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

function startDrag(e, nodeId) {
  dragNodeId = nodeId;
  const node = nodes[nodeId];

  // Convert mouse (clientX, clientY) → SVG coords
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

  // After moving, ancestors may need to adjust size
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


// =======================================================
// 3.18 — UPDATE PARENT‐CHAIN: ensure parents enclose children
// =======================================================

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

  // Build bounding box of all child circles
  const boxes = parent.children.map((cid) => {
    const c = nodes[cid];
    return {
      minX: c.x - c.radius,
      maxX: c.x + c.radius,
      minY: c.y - c.radius,
      maxY: c.y + c.radius
    };
  });

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  boxes.forEach((b) => {
    if (b.minX < minX) minX = b.minX;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxY > maxY) maxY = b.maxY;
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const halfWidth = (maxX - minX) / 2;
  const halfHeight = (maxY - minY) / 2;
  const requiredRadius = Math.max(halfWidth, halfHeight);

  parent.x = centerX;
  parent.y = centerY;
  parent.radius = requiredRadius + PARENT_PADDING;
}
