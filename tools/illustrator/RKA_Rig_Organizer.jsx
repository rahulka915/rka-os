#target illustrator
#targetengine "rkaRigOrganizer"

(function () {
    var RIG_LAYER = "RKA_RIG";
    var BACKUP_LAYER = "GENERATION_BACKUP";

    var PARTS = [
        ["RONIN", "Hair Back"],
        ["RONIN", "Backpack"],
        ["RONIN", "Rear Upper Arm"],
        ["RONIN", "Rear Forearm"],
        ["RONIN", "Rear Hand"],
        ["RONIN", "Rear Thigh"],
        ["RONIN", "Rear Shin"],
        ["RONIN", "Rear Boot"],
        ["RONIN", "Torso"],
        ["RONIN", "Head"],
        ["RONIN", "Hair Front"],
        ["RONIN", "Headband Band"],
        ["RONIN", "Headband Tail 1"],
        ["RONIN", "Headband Tail 2"],
        ["RONIN", "Front Upper Arm"],
        ["RONIN", "Front Forearm"],
        ["RONIN", "Front Hand"],
        ["RONIN", "Front Thigh"],
        ["RONIN", "Front Shin"],
        ["RONIN", "Front Boot"],
        ["RONIN", "Sword"],
        ["RONIN", "Face Details"],
        ["RONIN", "Sash"],
        ["CAT", "Tail"],
        ["CAT", "Rear Legs"],
        ["CAT", "Body"],
        ["CAT", "Front Legs"],
        ["CAT", "Head"],
        ["CAT", "Face Details"],
        ["CAT", "Collar"]
    ];

    if (app.documents.length === 0) {
        alert("Open the Illustrator document containing the generated Ronin artwork, then run this script again.");
        return;
    }

    var doc = app.activeDocument;

    function layerByName(parent, name) {
        var layers = parent.layers;
        var i;
        for (i = 0; i < layers.length; i++) {
            if (layers[i].name === name) return layers[i];
        }
        var layer = layers.add();
        layer.name = name;
        return layer;
    }

    function groupByName(layer, name) {
        var i;
        for (i = 0; i < layer.groupItems.length; i++) {
            if (layer.groupItems[i].name === name) return layer.groupItems[i];
        }
        return null;
    }

    function pathContainsLayer(item, layer) {
        var node = item;
        while (node && node.typename !== "Document") {
            if (node === layer) return true;
            node = node.parent;
        }
        return false;
    }

    function selectionArray() {
        var result = [];
        var i;
        for (i = 0; i < doc.selection.length; i++) result.push(doc.selection[i]);
        return result;
    }

    function containsUnsafeClipping(items) {
        var i;
        for (i = 0; i < items.length; i++) {
            if (items[i].clipping === true) return true;
            if (items[i].typename === "GroupItem" && items[i].clipped === true) return true;
        }
        return false;
    }

    var rigLayer = layerByName(doc, RIG_LAYER);
    var roninLayer = layerByName(rigLayer, "RONIN");
    var catLayer = layerByName(rigLayer, "CAT");
    var backupLayer = layerByName(doc, BACKUP_LAYER);

    function createBackupIfNeeded() {
        if (backupLayer.pageItems.length > 0) return true;
        var selected = selectionArray();
        if (selected.length === 0) {
            alert("Before first setup, select the complete generated Ronin and cat artwork, then run the script again.\n\nThe script needs that selection to create a safe backup.");
            return false;
        }

        var backupGroup = backupLayer.groupItems.add();
        backupGroup.name = "Original Generated Artwork";
        var i;
        for (i = selected.length - 1; i >= 0; i--) {
            selected[i].duplicate(backupGroup, ElementPlacement.PLACEATBEGINNING);
        }
        doc.selection = null;
        backupLayer.visible = false;
        backupLayer.locked = true;
        return true;
    }

    if (!createBackupIfNeeded()) return;
    doc.activeLayer = rigLayer;

    function layerFor(category) {
        return category === "CAT" ? catLayer : roninLayer;
    }

    function labelFor(index) {
        return PARTS[index][0] + " / " + PARTS[index][1];
    }

    function isComplete(index) {
        return groupByName(layerFor(PARTS[index][0]), PARTS[index][1]) !== null;
    }

    function firstIncomplete() {
        var i;
        for (i = 0; i < PARTS.length; i++) if (!isComplete(i)) return i;
        return 0;
    }

    function refreshList() {
        var selectedIndex = partList.selection ? partList.selection.index : firstIncomplete();
        partList.removeAll();
        var i;
        for (i = 0; i < PARTS.length; i++) {
            partList.add("item", (isComplete(i) ? "✓  " : "○  ") + labelFor(i));
        }
        if (selectedIndex >= PARTS.length) selectedIndex = PARTS.length - 1;
        partList.selection = selectedIndex;

        var complete = 0;
        for (i = 0; i < PARTS.length; i++) if (isComplete(i)) complete++;
        progress.text = complete + " of " + PARTS.length + " animation groups assigned";
    }

    function selectNextIncomplete(afterIndex) {
        var offset;
        for (offset = 1; offset <= PARTS.length; offset++) {
            var index = (afterIndex + offset) % PARTS.length;
            if (!isComplete(index)) {
                partList.selection = index;
                return;
            }
        }
    }

    function assignSelection() {
        if (!partList.selection) return;
        var index = partList.selection.index;
        var category = PARTS[index][0];
        var partName = PARTS[index][1];
        var targetLayer = layerFor(category);
        var selected = selectionArray();

        if (selected.length === 0) {
            alert("Select every shape belonging to “" + partName + "” on the canvas, then click Assign Selection again.");
            return;
        }

        var i;
        for (i = 0; i < selected.length; i++) {
            if (pathContainsLayer(selected[i], backupLayer)) {
                alert("The selection includes the locked backup. Keep GENERATION_BACKUP hidden and select shapes from the working artwork only.");
                return;
            }
            if (pathContainsLayer(selected[i], rigLayer)) {
                alert("The selection includes an already assigned rig group. Unlock that group first if you intend to rebuild it.");
                return;
            }
        }

        if (containsUnsafeClipping(selected)) {
            var proceed = confirm("This selection contains a clipping path or clipped group. Moving only part of it may change the appearance.\n\nContinue only if the complete clipped group is selected.");
            if (!proceed) return;
        }

        var existing = groupByName(targetLayer, partName);
        if (existing !== null) {
            alert("“" + partName + "” already exists. Use Unlock Current if you need to edit or replace it.");
            return;
        }

        var group = targetLayer.groupItems.add();
        group.name = partName;
        for (i = selected.length - 1; i >= 0; i--) {
            selected[i].move(group, ElementPlacement.PLACEATBEGINNING);
        }
        doc.selection = null;
        group.locked = true;
        refreshList();
        selectNextIncomplete(index);
        app.redraw();
    }

    function unlockCurrent() {
        if (!partList.selection) return;
        var index = partList.selection.index;
        var group = groupByName(layerFor(PARTS[index][0]), PARTS[index][1]);
        if (group === null) {
            alert("That animation group has not been assigned yet.");
            return;
        }
        group.locked = false;
        group.selected = true;
        app.redraw();
    }

    function lockAllAssigned() {
        var i;
        doc.selection = null;
        for (i = 0; i < PARTS.length; i++) {
            var group = groupByName(layerFor(PARTS[i][0]), PARTS[i][1]);
            if (group !== null) group.locked = true;
        }
        app.redraw();
    }

    function audit() {
        var missing = [];
        var i;
        for (i = 0; i < PARTS.length; i++) if (!isComplete(i)) missing.push(labelFor(i));

        if (missing.length === 0) {
            alert("Rig organisation is complete.\n\nBefore exporting:\n• Hide the original generated artwork if any unassigned source paths remain visible.\n• Keep GENERATION_BACKUP hidden.\n• Save the .ai file.\n• Export an SVG for structural review.");
        } else {
            alert("Missing " + missing.length + " animation groups:\n\n" + missing.join("\n"));
        }
    }

    var win = new Window("palette", "RKA Rig Organiser", undefined, {resizeable: true});
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 8;
    win.margins = 14;

    var intro = win.add("statictext", undefined, "Choose a part, select all of its shapes on the canvas, then assign it.", {multiline: true});
    intro.preferredSize.width = 420;
    intro.preferredSize.height = 38;

    var progress = win.add("statictext", undefined, "");
    partList = win.add("listbox", undefined, [], {multiselect: false});
    partList.preferredSize = [420, 430];

    var primary = win.add("group");
    primary.orientation = "row";
    var assignButton = primary.add("button", undefined, "Assign Selection");
    var unlockButton = primary.add("button", undefined, "Unlock Current");

    var secondary = win.add("group");
    secondary.orientation = "row";
    var lockButton = secondary.add("button", undefined, "Lock All Assigned");
    var auditButton = secondary.add("button", undefined, "Finish & Audit");
    var closeButton = secondary.add("button", undefined, "Close");

    assignButton.onClick = assignSelection;
    unlockButton.onClick = unlockCurrent;
    lockButton.onClick = lockAllAssigned;
    auditButton.onClick = audit;
    closeButton.onClick = function () { win.close(); };

    win.onResizing = win.onResize = function () { this.layout.resize(); };
    refreshList();
    win.center();
    win.show();
})();
