Draw.loadPlugin(function (ui) {
  var graph = ui.editor.graph;
  var model = graph.getModel();
  alert('layers.js загружен');

  var ghostRefs = {}, btnActive = {};

  function getLayers() { return model.getChildCells(model.getRoot(), true); }
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
    var wanted = (spec || '').split(',').map(function (s) { return s.trim(); });
    return getLayers().filter(function (l) {
      var name = String(l.value != null ? l.value : '').trim();
      return wanted.indexOf(name) >= 0 || wanted.indexOf(l.id) >= 0;
    });
  }

  graph.addListener(mxEvent.CLICK, function (sender, evt) {
    var cell = evt.getProperty('cell');
    if (!cell) return;
    var mode = cell.value && cell.value.getAttribute ? cell.value.getAttribute('layerMode') : null;
    if (!mode) return;
    var spec = cell.value.getAttribute('layers');
    var targets = findLayers(spec);
    alert('Режим: ' + mode + '\nИщу слои: ' + spec + '\nНайдено: ' + targets.length +
          '\nВсе слои: ' + getLayers().map(function (l) { return '[' + l.value + ']'; }).join(' '));
    if (!targets.length) return;

    if (mode === 'hide') {
      var show = !model.isVisible(targets[0]);
      model.beginUpdate();
      try { targets.forEach(function (l) { model.setVisible(l, show); }); }
      finally { model.endUpdate(); }
    } else if (mode === 'ghost') {
      var layers = getLayers(), maxIdx = 0;
      targets.forEach(function (l) { maxIdx = Math.max(maxIdx, layers.indexOf(l)); });
      if (btnActive[cell.id]) {
        btnActive[cell.id].forEach(function (id) { ghostRefs[id]--; });
        delete btnActive[cell.id];
      } else {
        btnActive[cell.id] = layers.slice(0, maxIdx).map(function (l) {
          ghostRefs[l.id] = (ghostRefs[l.id] || 0) + 1;
          return l.id;
        });
      }
      graph.refresh();
    }
  });

  ['isCellEditable', 'isCellMovable', 'isCellResizable', 'isCellRotatable',
   'isCellDeletable', 'isCellConnectable', 'isCellBendable', 'isCellDisconnectable']
    .forEach(function (name) {
      var orig = graph[name];
      graph[name] = function (cell) {
        if (cell && isGhost(cell)) return false;
        return orig.apply(this, arguments);
      };
    });

  var origRedraw = mxCellRenderer.prototype.redraw;
  mxCellRenderer.prototype.redraw = function (state) {
    origRedraw.apply(this, arguments);
    if (state && state.cell) {
      var v = isGhost(state.cell) ? '0.3' : '';
      if (state.shape && state.shape.node) state.shape.node.style.opacity = v;
      if (state.text && state.text.node) state.text.node.style.opacity = v;
    }
  };
});
