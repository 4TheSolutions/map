// =================================
// GLOBAL VARIABLES & SETTINGS
// =================================

// All nodes stored as { id: { id, label, x, y, radius, parent, children, predecessor } }
let nodes = {};

// Tracks the last-added node’s ID (for drawing arrows)
let lastAddedId = null;

// Next integer ID to assign to a new node
let nextNodeId = 1;

// Currently selected node ID (null if none)
let selectedNodeId = null;

// Reference to the <svg> canvas element
let svg = null;

// Appearance / layout constants
const DEFAULT_RADIUS = 40;    // Radius for a fresh node
const OFFSET_STEP = 60;       // Offset for successive root nodes
const PARENT_PADDING = 20;    // Extra padding so parents enclose children
const CHAR_WIDTH = 8;         // Approximate px per character for label width
const LABEL_HEIGHT = 20;      // Label rectangle height
const LABEL_GAP = 5;          // Gap between circle top and label
const SIZE_STEP = 10;         // Amount (px) to increase/decrease radius



// =================================
// INITIALIZATION on DOMContentLoaded
// =================================

window.addEventListener("DOMContentLoaded", () => {
  // Grab the <svg> element once
  svg = document.getElementById("canvas");

  // Load saved state from localStorage (if any)
  loadFromLocalStorage();

  // Wire up all buttons by their IDs
  document.getElementById("add-node").addEventListener("click", onAddNewNode);
  document.getElementById("add-child").addEventListener("click", onAddChild);
  document.getElementById("add-parent").addEventListener("click", onAddParent);
  document.getElementById("delete-node").addEventListener("click", onDeleteNode);
  document.getElementById("increase-size").addEventListener("click", onIncreaseSize);
  document.getElementById("decrease-size").addEventListener("click", onDecreaseSize);
  document.getElementById("reset-map").addEventListener("click", onResetMap);

  // Define the arrowhead marker inside <defs> once
  defineArrowheadMarker();

  // Initial render (draw any loaded nodes)
  renderAll();
});


// =================================
// LOCAL STORAGE: SAVE & LOAD
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
// BUTTON HANDLER: Add a BRAND-NEW (ROOT) Node
// ==============================================

function onAddNewNode() {
  const label = prompt("Enter a label for this new node:");
  if (!label) return; // user cancelled or empty

  // Decide placement: offset from last node, or default (150,150) if none exist
  let x, y;
  if (lastAddedId !== null && nodes[lastAddedId]) {
    const prev = nodes[lastAddedId];
    x = prev.x + OFFSET_STEP;
    y = prev.y + OFFSET_STEP;
  } else {
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
// BUTTON HANDLER: Add Child Node
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
  const radius = DEFAULT_RADIUS * 0.8; // smaller than default

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
// BUTTON HANDLER: Add Parent Node
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

  // Create new parent in between oldParent and child
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

  // Rewire the child to point to new parent
  nodes[childId].parent = id;

  // If there was an old parent, replace childId with id in its children array
  if (oldParent !== null) {
    const siblings = nodes[oldParent].children;
    const idx = siblings.indexOf(childId);
    if (idx !== -1) {
      siblings.splice(idx, 1, id);
    }
  }

  // Auto-resize the new parent so it encloses its child
  resizeParentToFitChildren(id);

  lastAddedId = id;
  updateAncestors(id);
  saveToLocalStorage();
  renderAll();
}


// ============================================
// BUTTON HANDLER: Delete Selected Node & Subtree
// ============================================

function onDeleteNode() {
  if (!selectedNodeId) {
    alert("Please click a node to select it before deleting.");
    return;
  }
  // Collect subtree IDs to delete
  const toDelete = collectSubtree(selectedNodeId);

  // If deleted node had a parent, remove it from parent's children
  const parentId = nodes[selectedNodeId].parent;
  if (parentId !== null && nodes[parentId]) {
    const arr = nodes[parentId].children;
    const idx = arr.indexOf(selectedNodeId);
    if (idx !== -1) arr.splice(idx, 1);
  }

  // Delete each node in the subtree
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

// Recursively collect a node and all its descendants
function collectSubtree(rootId) {
  let result = [rootId];
  const children = nodes[rootId].children;
  children.forEach((cid) => {
    result = result.concat(collectSubtree(cid));
  });
  return result;
}


// ================================================
// BUTTON HANDLER: Increase Selected Node’s Size
// ================================================

function onIncreaseSize() {
  if (!selectedNodeId) {
    alert("Please click a node to select it, then click Increase Size.");
    return;
  }
  const node = nodes[selectedNodeId];
  node.radius += SIZE_STEP;

  // After resizing, ancestors might need to expand
  updateAncestors(selectedNodeId);

  saveToLocalStorage();
  renderAll();
}


// ================================================
// BUTTON HANDLER: Decrease Selected Node’s Size
// (clamped so children remain inside)
// ================================================

function onDecreaseSize() {
  if (!selectedNodeId) {
    alert("Please click a node to select it, then click Decrease Size.");
    return;
  }
  const node = nodes[selectedNodeId];
  let newRadius = node.radius - SIZE_STEP;
  if (newRadius < 10) newRadius = 10; // absolute minimum

  // If node has children, ensure newRadius is large enough to enclose them
  if (node.children.length > 0) {
    // Build bounding box of all child circles
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
    // Required radius to cover children + padding
    const halfWidth = (maxX - minX) / 2;
    const halfHeight = (maxY - minY) / 2;
    const required = Math.max(halfWidth, halfHeight);
    const minimal = required + PARENT_PADDING;

    if (newRadius < minimal) {
      newRadius = minimal;
    }

    // Re-center the node on its children
    node.x = centerX;
    node.y = centerY;
  }

  node.radius = newRadius;

  // After shrinking, ancestors might need to shrink as well
  updateAncestors(selectedNodeId);

  saveToLocalStorage();
  renderAll();
}


// ====================================================
// BUTTON HANDLER: Reset Map (clear entire state)
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
// Define the Arrowhead Marker inside <defs> once
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
// MAIN RENDER LOOP: draw arrows behind, then nodes
// ================================================

function renderAll() {
  // 1) Clear any existing children in <svg>
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  // 2) Re‐insert our <defs> for arrowheads
  defineArrowheadMarker();

  // 3) Draw arrows first (so they lie behind nodes)
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


// =====================================================
// Draw an arrow from nodeA’s label center to nodeB’s label center
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
// Draw a single node: circle (transparent) + label
// ==================================================

function drawNode(node) {
  // Wrap circle + label in a <g> so dragging either moves both
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("data-node-id", node.id);

  // 1) Draw the transparent circle with stroke
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

  // 2) Compute label rectangle coords/size
  const { x: rectX, y: rectY, width: rectW, height: rectH } =
    computeLabelRect(node);

  // 3) Draw label background (white rectangle)
  const rectBG = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rectBG.setAttribute("x", rectX);
  rectBG.setAttribute("y", rectY);
  rectBG.setAttribute("width", rectW);
  rectBG.setAttribute("height", rectH);
  rectBG.setAttribute("class", "node-label-rect");
  g.appendChild(rectBG);

  // 4) Draw label text, centered on top of rectangle
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

  // 6) Mousedown on <g> begins drag operation
  g.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    startDrag(e, node.id);
  });

  svg.appendChild(g);
}


// =======================================================
// Compute the label rectangle’s position+size for a node
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
// Node selection: highlight (orange) or unhighlight
// ================================================

function selectNode(id) {
  if (selectedNodeId === id) {
    selectedNodeId = null; // toggle off if already selected
  } else {
    selectedNodeId = id;
  }
  renderAll();
}


// ================================================
// DRAGGING LOGIC (mouse events) for moving nodes
// ================================================

let dragNodeId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

function startDrag(e, nodeId) {
  dragNodeId = nodeId;
  const node = nodes[nodeId];

  // Convert mouse position → SVG coords
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

  // After moving, ancestors may need to resize/shift
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
// Ensure parents enclose all child circles (resize/center)
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

  // Build bounding box around all child circles
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
