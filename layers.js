js
Draw.loadPlugin(function (ui) {
  var graph = ui.editor.graph;
  var model = graph.getModel();
  var GHOST_OPACITY = 0.3;

  var ghostRefs = {};   // layerId -> сколько кнопок держат слой в ghost
  var btnActive = {};   // buttonId -> [layerId,...], которые включила эта кнопка

  function getLayers() {
    return model.getChildCells(model.getRoot(), true);
  }

  function layerOf(cell) {
    var root = model.getRoot();
    while (cell != null) {
      var p = model.getParent(cell);
      if (p === root) return cell;
      cell = p;
    }
    return null;
  }

  function isGhost(cell) {
    var l = layerOf(cell);
    return l != null && (ghostRefs[l.id] || 0) > 0;
  }

  function findLayers(spec) {
    if (!spec) return [];
    var wanted = spec.split(',').map(function (s) { return s.trim(); });
    return getLayers().filter(function (l) {
      var name = (graph.convertValueToString(l) || '').trim();
      return wanted.indexOf(name) >= 0 || wanted.indexOf(l.id) >= 0;
    });
  }

  // ---- Режим 1: скрыть / показать ----
  function toggleHide(targets) {
    var show = !model.isVisible(targets[0]);
    model.beginUpdate();
    try {
      targets.forEach(function (l) { model.setVisible(l, show); });
    } finally { model.endUpdate(); }
    graph.clearSelection();
  }

  // ---- Режим 2: полупрозрачность + защита нижних слоёв ----
  function toggleGhost(btn, targets) {
    var layers = getLayers();
    var maxIdx = 0;
    targets.forEach(function (l) { maxIdx = Math.max(maxIdx, layers.indexOf(l)); });
    var below = layers.slice(0, maxIdx);

    if (btnActive[btn.id]) {                       // выключаем
      btnActive[btn.id].forEach(function (id) { ghostRefs[id]--; });
      delete btnActive[btn.id];
    } else {                                       // включаем
      btnActive[btn.id] = below.map(function (l) {
        ghostRefs[l.id] = (ghostRefs[l.id] || 0) + 1;
        return l.id;
      });
    }
    graph.clearSelection();
    graph.refresh();
  }

  // ---- Обработка клика по кнопке ----
  graph.addListener(mxEvent.CLICK, function (sender, evt) {
    var cell = evt.getProperty('cell');
    if (!cell || !cell.value || !cell.value.getAttribute) return;
    var mode = cell.value.getAttribute('layerMode');
    if (!mode) return;
    var targets = findLayers(cell.value.getAttribute('layers'));
    if (!targets.length) return;
    if (mode === 'hide') toggleHide(targets);
    else if (mode === 'ghost') toggleGhost(cell, targets);
  });

  // ---- Запрет редактирования для ghost-слоёв (выделение и копирование остаются) ----
  ['isCellEditable', 'isCellMovable', 'isCellResizable', 'isCellRotatable',
   'isCellDeletable', 'isCellConnectable', 'isCellBendable', 'isCellDisconnectable']
    .forEach(function (name) {
      var orig = graph[name];
      graph[name] = function (cell) {
        if (cell && isGhost(cell)) return false;
        return orig.apply(this, arguments);
      };
    });

  // ---- Визуальная полупрозрачность (в файл не сохраняется) ----
  var origRedraw = mxCellRenderer.prototype.redraw;
  mxCellRenderer.prototype.redraw = function (state) {
    origRedraw.apply(this, arguments);
    if (state && state.cell) {
      var v = isGhost(state.cell) ? String(GHOST_OPACITY) : '';
      if (state.shape && state.shape.node) state.shape.node.style.opacity = v;
      if (state.text && state.text.node) state.text.node.style.opacity = v;
    }
  };
});