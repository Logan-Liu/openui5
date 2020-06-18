// Use this test page to test the API and features of the FieldHelp.
// The interaction with the Field is tested on the field test page.

/* global QUnit, sinon */
/*eslint max-nested-callbacks: [2, 5]*/

sap.ui.define([
	"sap/ui/mdc/field/FieldHelpBase",
	"sap/ui/mdc/field/FieldHelpBaseDelegate",
	"sap/ui/mdc/field/CustomFieldHelp",
	"sap/ui/mdc/condition/Condition",
	"sap/ui/core/Icon",
	"sap/ui/model/Context",
	"sap/ui/model/FormatException",
	"sap/ui/model/ParseException",
	"sap/m/library",
	"sap/m/Popover"
], function (
		FieldHelpBase,
		FieldHelpBaseDelegate,
		CustomFieldHelp,
		Condition,
		Icon,
		Context,
		FormatException,
		ParseException,
		mLibrary,
		Popover
	) {
	"use strict";

	var iPopoverDuration = 355;
	var oFieldHelp;
	var oField;
	var oField2;
	var iDisconnect = 0;
	var iSelect = 0;
	var aSelectConditions;
	var iOpen = 0;
	var bOpenSuggest;

	var _myDisconnectHandler = function(oEvent) {
		iDisconnect++;
	};

	var _mySelectHandler = function(oEvent) {
		iSelect++;
		aSelectConditions = oEvent.getParameter("conditions");
	};

	var _fPressHandler = function(oEvent) {}; // just dummy handler to make Icon focusable

	var _myOpenHandler = function(oEvent) {
		iOpen++;
		bOpenSuggest = oEvent.getParameter("suggestion");
		// fake Content of Popover
		var oPopover = oFieldHelp.getAggregation("_popover");
		if (oPopover && oPopover.getContent().length == 0) {
			oPopover.addContent(new Icon("I-Pop", {src:"sap-icon://sap-ui5", decorative: false, press: _fPressHandler}));
		}
	};

	/* first test it without the Field to prevent loading of popup etc. */
	/* use dummy control to simulate Field */

	var oClock;
	var _initFields = function() {
		oField = new Icon("I1", {src:"sap-icon://sap-ui5", decorative: false, press: _fPressHandler});
		oField2 = new Icon("I2", {src:"sap-icon://sap-ui5", decorative: false, press: _fPressHandler});

		oField.placeAt("content");
		oField2.placeAt("content");
		sap.ui.getCore().applyChanges();
		oField.focus();
		oClock = sinon.useFakeTimers();
	};

	var _teardown = function() {
		if (oClock) {
			oClock.restore();
			oClock = undefined;
		}
		oFieldHelp.destroy();
		oFieldHelp = undefined;
		oField.destroy();
		oField = undefined;
		oField2.destroy();
		oField2 = undefined;
		iDisconnect = 0;
		iSelect = 0;
		aSelectConditions = undefined;
		iOpen = 0;
		bOpenSuggest = undefined;
		FieldHelpBase._init();
	};

	QUnit.module("basic features", {
		beforeEach: function() {
			oFieldHelp = new FieldHelpBase("F1-H", {
				disconnect: _myDisconnectHandler,
				open: _myOpenHandler
			});
			_initFields();
		},
		afterEach: _teardown
	});

	QUnit.test("default values", function(assert) {

		assert.equal(oFieldHelp.getConditions().length, 0, "Conditions");
		assert.equal(oFieldHelp.getFilterValue(), "", "FilterValue");
		assert.notOk(oFieldHelp.openByTyping(), "openByTyping");
		assert.equal(oFieldHelp.getTextForKey("A"), "", "getTextForKey");
		assert.notOk(oFieldHelp.getKeyForText("A"), "getKeyForText");
		assert.equal(oFieldHelp.getIcon(), "sap-icon://slim-arrow-down", "Icon for FieldHelp");
		assert.ok(oFieldHelp.isUsableForValidation(), "isUsableForValidation");

	});

	QUnit.test("connect", function(assert) {

		oFieldHelp.connect(oField);
		assert.equal(iDisconnect, 0, "Disconnect not fired");

		oFieldHelp.setConditions([Condition.createItemCondition("1", "Test")]);
		oFieldHelp.setFilterValue("A");
		oFieldHelp.connect(oField2);
		assert.equal(iDisconnect, 1, "Disconnect fired");
		assert.equal(oFieldHelp.getConditions().length, 0, "Conditions");
		assert.equal(oFieldHelp.getFilterValue(), "", "FilterValue");

	});

	QUnit.test("_getField", function(assert) {

		oField.addDependent(oFieldHelp);
		var oMyField = oFieldHelp._getField();
		assert.equal(oMyField.getId(), "I1", "field using aggregation");

		oField.removeDependent(oFieldHelp);
		oFieldHelp.connect(oField2);
		oMyField = oFieldHelp._getField();
		assert.equal(oMyField.getId(), "I2", "field using connect");

	});

	QUnit.test("getFieldPath", function(assert) {

		oField.getFieldPath = function() {
			return "Test";
		};
		oField.addDependent(oFieldHelp);
		oFieldHelp.connect(oField);
		var sFieldPath = oFieldHelp.getFieldPath();
		assert.equal(sFieldPath, "Test", "FieldPath of Field returned");

	});

	QUnit.test("getUIArea", function(assert) {

		var oUIArea = oFieldHelp.getUIArea();
		assert.notOk(oUIArea, "No UIArea found");

		oFieldHelp.connect(oField);
		oUIArea = oFieldHelp.getUIArea();
		assert.ok(oUIArea, "UIArea found");

	});

	QUnit.test("open as aggregation", function(assert) {

		oField.addDependent(oFieldHelp);

		var oPopover = oFieldHelp.getAggregation("_popover");
		assert.notOk(oPopover, "No Popover initial created");

		oFieldHelp.open(); // no suggestion
		oClock.tick(iPopoverDuration); // fake opening time

		oPopover = oFieldHelp.getAggregation("_popover");
		assert.ok(oPopover, "Popover created by opening");
		if (oPopover) {
			assert.ok(oPopover.isOpen(), "Field help opened");
			assert.equal(oPopover._oOpenBy && oPopover._oOpenBy.getId(), "I1", "Popover opened by field");
			assert.equal(iOpen, 1, "Open event fired");
			assert.notOk(bOpenSuggest, "Open not as suggestion");

			oFieldHelp.close();
			oClock.tick(iPopoverDuration); // fake closing time

			assert.notOk(oPopover.isOpen(), "Field help closed");
		}

	});

	QUnit.test("open using connect (with async loading of Popover)", function(assert) {

		var oStub = sinon.stub(sap.ui, "require");
		oStub.withArgs("sap/m/Popover").onFirstCall().returns(undefined);
		oStub.callThrough();

		oClock.restore(); // as we need a timeout to test async loading of Popover
		oFieldHelp.open();
		var oPopover = oFieldHelp.getAggregation("_popover");
		assert.notOk(oPopover, "No Popover created if not assigned to field");

		var fnDone = assert.async();
		oFieldHelp.connect(oField);
		oFieldHelp.open(true); // suggestion
		setTimeout( function(){ // to wait until Popover is loaded
			oClock = sinon.useFakeTimers(); // now we can use fake timer again
			oClock.tick(iPopoverDuration); // fake opening time
			oPopover = oFieldHelp.getAggregation("_popover");
			assert.ok(oPopover, "Popover created by opening");
			if (oPopover) {
				assert.ok(oFieldHelp.isOpen(), "Field help opened");
				assert.ok(oPopover.isOpen(), "Popover opened");
				assert.equal(oPopover._oOpenBy.getId(), "I1", "Popover opened by field");
				assert.equal(iOpen, 1, "Open event fired");
				assert.ok(bOpenSuggest, "Open as suggestion");
				var oDomRef = oFieldHelp.getDomRef();
				assert.equal(oDomRef.id, "F1-H-pop", "DomRef of Popover used");
				var oScrollDelegate1 = oFieldHelp.getScrollDelegate();
				var oScrollDelegate2 = oPopover.getScrollDelegate();
				assert.equal(oScrollDelegate1, oScrollDelegate2, "oScrollDelegate of Popover used");

				oFieldHelp.connect(oField2);
				assert.ok(oFieldHelp.isOpen(), "Field help sill opened");
				assert.notOk(oFieldHelp.isOpen(true), "Field help not opened if closing is checked");

				oClock.tick(iPopoverDuration); // fake closing time
				assert.notOk(oPopover.isOpen(), "Field help closed");

				oFieldHelp.open();
				oClock.tick(iPopoverDuration); // fake opening time

				assert.ok(oPopover.isOpen(), "Field help opened");
				assert.equal(oPopover._oOpenBy.getId(), "I2", "Popover opened by field2");

				oFieldHelp.close();
				oClock.tick(iPopoverDuration); // fake closing time

				assert.notOk(oPopover.isOpen(), "Field help closed");
				fnDone();
			}
		}, 0);

		oStub.restore();

	});

	QUnit.test("toggle open", function(assert) {

		oField.addDependent(oFieldHelp);

		oFieldHelp.toggleOpen();
		oClock.tick(iPopoverDuration); // fake opening time

		var oPopover = oFieldHelp.getAggregation("_popover");
		if (oPopover) {
			assert.ok(oPopover.isOpen(), "Field help opened");
			assert.equal(oPopover._oOpenBy.getId(), "I1", "Popover opened by field");

			oFieldHelp.toggleOpen();
			oClock.tick(iPopoverDuration); // fake closing time

			assert.notOk(oPopover.isOpen(), "Field help closed");
			oFieldHelp.toggleOpen();
			assert.ok(oPopover.isOpen(), "Field help opened");
			oFieldHelp.toggleOpen();
			oFieldHelp.toggleOpen(); // directly open again during closing
			oClock.tick(iPopoverDuration); // fake opening time

			assert.ok(oPopover.isOpen(), "Field help open");
		}

		oFieldHelp.close();
		oClock.tick(iPopoverDuration); // fake closing time

	});

	QUnit.test("toggle open  (with async loading of Popover)", function(assert) {

		var oStub = sinon.stub(sap.ui, "require");
		oStub.withArgs("sap/m/Popover").onFirstCall().returns(undefined);
		oStub.callThrough();
		oClock.restore(); // as we need a timeout to test async loading of Popover

		// test toggling while loading phase, everything else is tested above
		oFieldHelp.connect(oField);
		oFieldHelp.open(true); // open
		oFieldHelp.toggleOpen(true); // close while popover is loading

		var fnDone = assert.async();
		setTimeout( function(){ // to wait until Popover is loaded
			oClock = sinon.useFakeTimers(); // now we can use fake timer again
			oClock.tick(iPopoverDuration); // fake opening time
			var oPopover = oFieldHelp.getAggregation("_popover");
			assert.ok(oPopover, "Popover exists");
			if (oPopover) {
				assert.notOk(oPopover.isOpen(), "Field help closed");
			}
			fnDone();
		}, 0);

		oStub.restore();

	});

	QUnit.test("getItemForValue: simple text", function(assert) {

		sinon.stub(oFieldHelp, "getTextForKey").returns("Text");
		sinon.stub(oFieldHelp, "getKeyForText").returns("Key");

		var oResult = oFieldHelp.getItemForValue("X", "X", "in", "out", "context", true, true, true);
		assert.deepEqual(oResult, {key: "X", description: "Text"}, "key and description returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith("X", "in", "out", "context"), "getTextForKey called");
		assert.notOk(oFieldHelp.getKeyForText.called, "getKeyForText not called");

		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();
		oResult = oFieldHelp.getItemForValue("X", "X", "in", "out", "context", true, false, true);
		assert.deepEqual(oResult, {key: "Key", description: "X"}, "key and description returned");
		assert.notOk(oFieldHelp.getTextForKey.called, "getTextForKey not called");
		assert.ok(oFieldHelp.getKeyForText.calledWith("X", "context"), "getKeyForText called");

		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();
		oResult = oFieldHelp.getItemForValue("X", "X", "in", "out", "context", false, true, true);
		assert.deepEqual(oResult, {key: "Key", description: "X"}, "key and description returned");
		assert.notOk(oFieldHelp.getTextForKey.called, "getTextForKey not called");
		assert.ok(oFieldHelp.getKeyForText.calledWith("X", "context"), "getKeyForText called");

		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();
		oResult = oFieldHelp.getItemForValue("X", "X", "in", "out", "context", false, true, false);
		assert.deepEqual(oResult, {key: "X", description: "Text"}, "key and description returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith("X", "in", "out", "context"), "getTextForKey called");
		assert.notOk(oFieldHelp.getKeyForText.called, "getKeyForText not called");

		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getTextForKey.returns(undefined);
		oFieldHelp.getKeyForText.resetHistory();
		oResult = oFieldHelp.getItemForValue("X", "X", "in", "out", "context", true, true, true);
		assert.deepEqual(oResult, {key: "Key", description: "X"}, "key and description returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith("X", "in", "out", "context"), "getTextForKey called");
		assert.ok(oFieldHelp.getKeyForText.calledWith("X", "context"), "getKeyForText called");

		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getTextForKey.returns("Text");
		oFieldHelp.getKeyForText.resetHistory();
		oFieldHelp.getKeyForText.returns(undefined);
		oResult = oFieldHelp.getItemForValue("X", "X", "in", "out", "context", false, true, true);
		assert.deepEqual(oResult, {key: "X", description: "Text"}, "key and description returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith("X", "in", "out", "context"), "getTextForKey called");
		assert.ok(oFieldHelp.getKeyForText.calledWith("X", "context"), "getKeyForText called");

		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getTextForKey.returns("");
		oFieldHelp.getKeyForText.resetHistory();
		oFieldHelp.getKeyForText.returns(undefined);
		oResult = oFieldHelp.getItemForValue("X", "X", "in", "out", "context", false, true, true);
		assert.equal(oResult, undefined, "no key and description returned");
		assert.ok(oFieldHelp.getTextForKey.calledOnce, "getTextForKey called once");
		assert.ok(oFieldHelp.getTextForKey.calledWith("X", "in", "out", "context"), "getTextForKey called");
		assert.ok(oFieldHelp.getKeyForText.calledOnce, "getKeyForText called once");
		assert.ok(oFieldHelp.getKeyForText.calledWith("X", "context"), "getKeyForText called");

	});

	QUnit.test("getItemForValue: object", function(assert) {

		sinon.stub(oFieldHelp, "getTextForKey").returns({key: "Key", description: "Text"});
		sinon.stub(oFieldHelp, "getKeyForText").returns({key: "Key", description: "Text"});

		var oResult = oFieldHelp.getItemForValue("X", "X", "in", "out", "context", true, true, true);
		assert.deepEqual(oResult, {key: "Key", description: "Text"}, "key and description returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith("X", "in", "out", "context"), "getTextForKey called");
		assert.notOk(oFieldHelp.getKeyForText.called, "getKeyForText not called");

		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();
		oResult = oFieldHelp.getItemForValue("X", "X", "in", "out", "context", true, false, true);
		assert.deepEqual(oResult, {key: "Key", description: "Text"}, "key and description returned");
		assert.notOk(oFieldHelp.getTextForKey.called, "getTextForKey not called");
		assert.ok(oFieldHelp.getKeyForText.calledWith("X", "context"), "getKeyForText called");

		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();
		oResult = oFieldHelp.getItemForValue("X", "X", "in", "out", "context", false, true, true);
		assert.deepEqual(oResult, {key: "Key", description: "Text"}, "key and description returned");
		assert.notOk(oFieldHelp.getTextForKey.called, "getTextForKey not called");
		assert.ok(oFieldHelp.getKeyForText.calledWith("X", "context"), "getKeyForText called");

		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();
		oResult = oFieldHelp.getItemForValue("X", "X", "in", "out", "context", false, true, false);
		assert.deepEqual(oResult, {key: "Key", description: "Text"}, "key and description returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith("X", "in", "out", "context"), "getTextForKey called");
		assert.notOk(oFieldHelp.getKeyForText.called, "getKeyForText not called");

		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getTextForKey.returns(undefined);
		oFieldHelp.getKeyForText.resetHistory();
		oResult = oFieldHelp.getItemForValue("X", "X", "in", "out", "context", true, true, true);
		assert.deepEqual(oResult, {key: "Key", description: "Text"}, "key and description returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith("X", "in", "out", "context"), "getTextForKey called");
		assert.ok(oFieldHelp.getKeyForText.calledWith("X", "context"), "getKeyForText called");

		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getTextForKey.returns({key: "Key", description: "Text"});
		oFieldHelp.getKeyForText.resetHistory();
		oFieldHelp.getKeyForText.returns(undefined);
		oResult = oFieldHelp.getItemForValue("X", "X", "in", "out", "context", false, true, true);
		assert.deepEqual(oResult, {key: "Key", description: "Text"}, "key and description returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith("X", "in", "out", "context"), "getTextForKey called");
		assert.ok(oFieldHelp.getKeyForText.calledWith("X", "context"), "getKeyForText called");

		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getTextForKey.returns(undefined);
		oFieldHelp.getKeyForText.resetHistory();
		oFieldHelp.getKeyForText.returns(undefined);
		oResult = oFieldHelp.getItemForValue("X", "X", "in", "out", "context", false, true, true);
		assert.equal(oResult, undefined, "no key and description returned");
		assert.ok(oFieldHelp.getTextForKey.calledOnce, "getTextForKey called once");
		assert.ok(oFieldHelp.getTextForKey.calledWith("X", "in", "out", "context"), "getTextForKey called");
		assert.ok(oFieldHelp.getKeyForText.calledOnce, "getKeyForText called once");
		assert.ok(oFieldHelp.getKeyForText.calledWith("X", "context"), "getKeyForText called");

	});

	QUnit.test("getItemForValue: promise", function(assert) {

		oClock.restore(); // need real Timeout to wait for Promises
		oClock = undefined;

		var fnResolveKey1;
		var oPromiseKey1 = new Promise(function(fResolve, fReject) {
			fnResolveKey1 = fResolve;
		});
		var fnResolveDescription1;
		var oPromiseDescription1 = new Promise(function(fResolve, fReject) {
			fnResolveDescription1 = fResolve;
		});

		var fnRejectKey2;
		var oPromiseKey2 = new Promise(function(fResolve, fReject) {
			fnRejectKey2 = fReject;
		});
		var fnResolveDescription2;
		var oPromiseDescription2 = new Promise(function(fResolve, fReject) {
			fnResolveDescription2 = fResolve;
		});

		var fnResolveKey3;
		var oPromiseKey3 = new Promise(function(fResolve, fReject) {
			fnResolveKey3 = fResolve;
		});
		var fnRejectDescription3;
		var oPromiseDescription3 = new Promise(function(fResolve, fReject) {
			fnRejectDescription3 = fReject;
		});

		var fnRejectKey4;
		var oPromiseKey4 = new Promise(function(fResolve, fReject) {
			fnRejectKey4 = fReject;
		});
		var fnRejectDescription4;
		var oPromiseDescription4 = new Promise(function(fResolve, fReject) {
			fnRejectDescription4 = fReject;
		});


		var fnRejectKey6;
		var oPromiseKey6 = new Promise(function(fResolve, fReject) {
			fnRejectKey6 = fReject;
		});

		var fnRejectKey7;
		var oPromiseKey7 = new Promise(function(fResolve, fReject) {
			fnRejectKey7 = fReject;
		});

		sinon.stub(oFieldHelp, "getTextForKey");
		oFieldHelp.getTextForKey.withArgs(1).returns(oPromiseKey1);
		oFieldHelp.getTextForKey.withArgs(2).returns(oPromiseKey2);
		oFieldHelp.getTextForKey.withArgs(3).returns(oPromiseKey3);
		oFieldHelp.getTextForKey.withArgs(4).returns(oPromiseKey4);
		oFieldHelp.getTextForKey.withArgs(5).returns(oPromiseKey4);
		oFieldHelp.getTextForKey.withArgs(6).returns(oPromiseKey6);
		oFieldHelp.getTextForKey.withArgs(7).returns(oPromiseKey7);

		sinon.stub(oFieldHelp, "getKeyForText");
		oFieldHelp.getKeyForText.withArgs("1").returns(oPromiseDescription1);
		oFieldHelp.getKeyForText.withArgs("2").returns(oPromiseDescription2);
		oFieldHelp.getKeyForText.withArgs("3").returns(oPromiseDescription3);
		oFieldHelp.getKeyForText.withArgs("4").returns(oPromiseDescription4);
		oFieldHelp.getKeyForText.withArgs("5").returns(undefined);
		oFieldHelp.getKeyForText.withArgs("6").returns("Text");
		oFieldHelp.getKeyForText.withArgs("7").returns("Text");

		var fnDone = assert.async();
		var iFinished = 0;

		// key checked first and directly found
		var oResult = oFieldHelp.getItemForValue("1", 1, "in", "out", "context", true, true, true);
		assert.ok(oResult instanceof Promise, "Test1: Promise returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith(1, "in", "out", "context"), "Test1: getTextForKey called");
		assert.notOk(oFieldHelp.getKeyForText.called, "Test1: getKeyForText not called");
		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();

		oResult.then(function(oResult) {
			assert.deepEqual(oResult, {key: 1, description: "Text"}, "Test1: key and description returned");
			iFinished++;
		}).catch(function(oError) {
			assert.notOk(true, "Test1: Promise Catch not called");
			iFinished++;
		});

		// Description checked first and directly found
		oResult = oFieldHelp.getItemForValue("1", 1, "in", "out", "context", false, true, true);
		assert.ok(oResult instanceof Promise, "Test2: Promise returned");
		assert.notOk(oFieldHelp.getTextForKey.called, "Test2: getTextForKey not called");
		assert.ok(oFieldHelp.getKeyForText.calledWith("1", "context"), "Test2: getKeyForText called");
		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();

		oResult.then(function(oResult) {
			assert.deepEqual(oResult, {key: "Key", description: "1"}, "Test2: key and description returned");
			iFinished++;
		}).catch(function(oError) {
			assert.notOk(true, "Test2: Promise Catch not called");
			iFinished++;
		});

		fnResolveKey1("Text"); // return just the description
		fnResolveDescription1("Key"); // return just the text

		// key checked first and not found but description found
		oResult = oFieldHelp.getItemForValue("2", 2, "in", "out", "context", true, true, true);
		assert.ok(oResult instanceof Promise, "Test3: Promise returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith(2, "in", "out", "context"), "Test3: getTextForKey called");
		assert.notOk(oFieldHelp.getKeyForText.called, "Test3: getKeyForText not called");
		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();

		fnRejectKey2(new ParseException("notFound")); // raise exception
		fnResolveDescription2({key: "Key", description: "Text"}); // return an object

		oResult.then(function(oResult) {
			assert.deepEqual(oResult, {key: "Key", description: "Text"}, "Test3: key and description returned");
			iFinished++;
		}).catch(function(oError) {
			assert.notOk(true, "Test3: Promise Catch not called");
			iFinished++;
		});

		// key checked first and not found and no check for description
		oResult = oFieldHelp.getItemForValue("2", 2, "in", "out", "context", true, true, false);
		assert.ok(oResult instanceof Promise, "Test4: Promise returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith(2, "in", "out", "context"), "Test4: getTextForKey called");
		assert.notOk(oFieldHelp.getKeyForText.called, "Test4: getKeyForText not called");
		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();

		oResult.then(function(oResult) {
			assert.notOk(true, "Test4: Promise Then not called");
			iFinished++;
		}).catch(function(oError) {
			assert.ok(true, "Test4: Promise Catch called");
			assert.equal(oError.message, "notFound", "Test4: Error message");
			iFinished++;
		});

		// Description checked first and not found but key found
		oResult = oFieldHelp.getItemForValue("3", 3, "in", "out", "context", false, true, true);
		assert.ok(oResult instanceof Promise, "Test5: Promise returned");
		assert.notOk(oFieldHelp.getTextForKey.called, "Test5: getTextForKey not called");
		assert.ok(oFieldHelp.getKeyForText.calledWith("3", "context"), "Test5: getKeyForText called");
		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();

		fnResolveKey3({key: "Key", description: "Text"}); // return an object
		fnRejectDescription3(new ParseException("notFound")); // raise exception

		oResult.then(function(oResult) {
			assert.deepEqual(oResult, {key: "Key", description: "Text"}, "Test5: key and description returned");
			iFinished++;
		}).catch(function(oError) {
			assert.notOk(true, "Test5: Promise Catch not called");
			iFinished++;
		});

		// description checked first and not found and no check for key
		oResult = oFieldHelp.getItemForValue("3", 3, "in", "out", "context", false, false, true);
		assert.ok(oResult instanceof Promise, "Test6: Promise returned");
		assert.notOk(oFieldHelp.getTextForKey.called, "Test6: getTextForKey not called");
		assert.ok(oFieldHelp.getKeyForText.calledWith("3", "context"), "Test6: getKeyForText called");
		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();

		oResult.then(function(oResult) {
			assert.notOk(true, "Test6: Promise Then not called");
			iFinished++;
		}).catch(function(oError) {
			assert.ok(true, "Test6: Promise Catch called");
			assert.equal(oError.message, "notFound", "Test6: Error message");
			iFinished++;
		});

		// Key checked first and not found and description not found too
		oResult = oFieldHelp.getItemForValue("4", 4, "in", "out", "context", true, true, true);
		assert.ok(oResult instanceof Promise, "Test7: Promise returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith(4, "in", "out", "context"), "Test7: getTextForKey called");
		assert.notOk(oFieldHelp.getKeyForText.called, "Test7: getKeyForText not called");
		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();

		fnRejectKey4(new ParseException("KeyNotFound")); // raise exception
		fnRejectDescription4(new ParseException("DescriptionNotFound")); // raise exception

		oResult.then(function(oResult) {
			assert.notOk(true, "Test7: Promise Then not called");
			iFinished++;
		}).catch(function(oError) {
			assert.ok(true, "Test7: Promise Catch called");
			assert.equal(oError.message, "DescriptionNotFound", "Test7: Error message");
			iFinished++;
		});

		// Key checked first and not found and description not found too (but no exception)
		oResult = oFieldHelp.getItemForValue("5", 5, "in", "out", "context", true, true, true);
		assert.ok(oResult instanceof Promise, "Test8: Promise returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith(5, "in", "out", "context"), "Test8: getTextForKey called");
		assert.notOk(oFieldHelp.getKeyForText.called, "Test8: getKeyForText not called");
		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();

		oResult.then(function(oResult) {
			assert.notOk(true, "Test8: Promise Then not called");
			iFinished++;
		}).catch(function(oError) {
			assert.ok(true, "Test8: Promise Catch called");
			assert.equal(oError.message, "KeyNotFound", "Test8: Error message");
			iFinished++;
		});

		//  Key checked first but other exception thrown
		oResult = oFieldHelp.getItemForValue("6", 6, "in", "out", "context", true, true, true);
		assert.ok(oResult instanceof Promise, "Test9: Promise returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith(6, "in", "out", "context"), "Test9: getTextForKey called");
		assert.notOk(oFieldHelp.getKeyForText.called, "Test9: getKeyForText not called");
		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();

		fnRejectKey6(new Error("MyError")); // raise exception

		oResult.then(function(oResult) {
			assert.notOk(true, "Test9: Promise Then not called");
			iFinished++;
		}).catch(function(oError) {
			assert.ok(true, "Test9: Promise Catch called");
			assert.equal(oError.message, "MyError", "Test9: Error message");
			iFinished++;
		});

		//  Key checked first but not unique
		oResult = oFieldHelp.getItemForValue("7", 7, "in", "out", "context", true, true, true);
		assert.ok(oResult instanceof Promise, "Test10: Promise returned");
		assert.ok(oFieldHelp.getTextForKey.calledWith(7, "in", "out", "context"), "Test10: getTextForKey called");
		assert.notOk(oFieldHelp.getKeyForText.called, "Test10: getKeyForText not called");
		oFieldHelp.getTextForKey.resetHistory();
		oFieldHelp.getKeyForText.resetHistory();

		var oException = new ParseException("notUnique");
		oException._bNotUnique = true;
		fnRejectKey7(oException); // raise exception

		oResult.then(function(oResult) {
			assert.notOk(true, "Test10: Promise Then not called");
			iFinished++;
		}).catch(function(oError) {
			assert.ok(true, "Test10: Promise Catch called");
			assert.equal(oError.message, "notUnique", "Test10: Error message");
			iFinished++;
		});

		setTimeout( function(){ // as promise is resolves async
			assert.equal(iFinished, 10, "All promises finished");
			fnDone();
		}, 0);

	});

	QUnit.module("no default content", {
		beforeEach: function() {
			oFieldHelp = new FieldHelpBase("F1-H", {
				disconnect: _myDisconnectHandler
			});
			_initFields();
		},
		afterEach: _teardown
	});

	QUnit.test("_setContent", function(assert) {

		var oContent = new Icon("I3", {src:"sap-icon://sap-ui5", decorative: false, press: _fPressHandler});
		oFieldHelp._setContent(oContent);

		oField.addDependent(oFieldHelp);
		oFieldHelp.open();
		var oPopover = oFieldHelp.getAggregation("_popover");
		var aContent = oPopover.getContent();
		assert.equal(aContent.length, 1, "Popover has content");
		if (aContent[0]) {
			assert.equal(aContent[0].getId(), "I3", "Popover content");
		}
		oContent.destroy();

	});

	QUnit.test("_setContent after open", function(assert) {

		var oContent = new Icon("I3", {src:"sap-icon://sap-ui5", decorative: false, press: _fPressHandler});

		oField.addDependent(oFieldHelp);
		oFieldHelp.open();
		var oPopover = oFieldHelp.getAggregation("_popover");
		assert.notOk(oPopover.isOpen(), "Popover not opened");
		oFieldHelp._setContent(oContent);
		assert.ok(oPopover.isOpen(), "Popover opened");
		var aContent = oPopover.getContent();
		assert.equal(aContent.length, 1, "Popover has content");
		if (aContent[0]) {
			assert.equal(aContent[0].getId(), "I3", "Popover content");
		}
		oContent.destroy();

	});

	var iBeforeOpen = 0;

	var _myBeforeOpenHandler = function(oEvent) {
		iBeforeOpen++;
	};

	QUnit.module("CustomFieldHelp", {
		beforeEach: function() {
			oFieldHelp = new CustomFieldHelp("F1-H", {
				content: [new Icon("I3", {src:"sap-icon://sap-ui5", decorative: false, press: _fPressHandler})],
				disconnect: _myDisconnectHandler,
				beforeOpen: _myBeforeOpenHandler,
				select: _mySelectHandler
			});
			_initFields();
			oField.addDependent(oFieldHelp);
		},
		afterEach: function() {
			_teardown();
			iBeforeOpen = 0;
		}
	});

	QUnit.test("content display", function(assert) {

		oFieldHelp.open();
		oClock.tick(iPopoverDuration); // fake opening time

		var oPopover = oFieldHelp.getAggregation("_popover");
		if (oPopover) {
			var oContent = oPopover._getAllContent()[0];
			assert.ok(oContent, "Popover has content");
			assert.equal(oContent.getId(), "I3", "content is Icon");
			assert.notOk(oPopover.getInitialFocus(), "Initial focus on Popover");
			assert.ok(iBeforeOpen > 0, "BeforeOpen event fired");
		}

		oFieldHelp.close();
		oClock.tick(iPopoverDuration); // fake closing time

	});

	QUnit.test("fireSelectEvent", function(assert) {

		var oCondition = Condition.createItemCondition("A", "B");
		oFieldHelp.fireSelectEvent([oCondition]);
		assert.equal(iSelect, 1, "Select event fired");
		assert.equal(aSelectConditions.length, 1, "One condition selected");
		assert.equal(aSelectConditions[0].values[0], "A", "Selected condition value0");
		assert.equal(aSelectConditions[0].values[1], "B", "Selected condition value1");

	});

	QUnit.module("delegate", {
		beforeEach: function() {
			oFieldHelp = new FieldHelpBase("F1-H", {
				disconnect: _myDisconnectHandler,
				open: _myOpenHandler
			});
			_initFields();
		},
		afterEach: _teardown
	});

	QUnit.test("default delegate", function(assert) {

		assert.ok(oFieldHelp.awaitControlDelegate(), "Delegate Promise initially created");

		var oDelegate = oFieldHelp.getDelegate();

		assert.notOk(oFieldHelp.bDelegateInitialized, "no Delegate module assigned");

		// Delegate must be loaded if needed.
		oFieldHelp.initControlDelegate();

		oDelegate = oFieldHelp.getDelegate();

		assert.deepEqual(oDelegate, {name: "sap/ui/mdc/field/FieldHelpBaseDelegate"}, "used Delegate");

		assert.equal(oFieldHelp.getControlDelegate(), FieldHelpBaseDelegate, "Delegate module used");

	});

	QUnit.test("open with async contentRequest", function(assert) {

		var fnResolve;
		var oPromise = new Promise(function(fnMyResolve, fnMyReject) {
			fnResolve = fnMyResolve;
		});

		sinon.stub(FieldHelpBaseDelegate, "contentRequest").returns(oPromise);
		oClock.restore(); // as we need a timeout to test async Promise

		oFieldHelp.connect(oField);
		oFieldHelp.open(); // no suggestion

		var oPopover = oFieldHelp.getAggregation("_popover");
		sinon.spy(oPopover, "openBy");

		assert.ok(FieldHelpBaseDelegate.contentRequest.called, "FieldHelpBaseDelegate.contentRequest called");
		assert.ok(FieldHelpBaseDelegate.contentRequest.calledWith(undefined, oFieldHelp, false), "FieldHelpBaseDelegate.contentRequest called with no suggestion");
		assert.equal(iOpen, 0, "Open event not fired as promise is not resolved right now");
		assert.notOk(oPopover.openBy.called, "Popover not opened as promise is not resolved right now");

		fnResolve();
		var fnDone = assert.async();
		setTimeout( function(){ // as promise is resolves async
			oClock = sinon.useFakeTimers(); // now we can use fake timer again
			assert.ok(oPopover.openBy.called, "Popover opened");
			assert.equal(iOpen, 1, "Open event fired");
			iOpen = 0;
			oPopover.openBy.reset();
			oClock.tick(iPopoverDuration); // fake opening time

			oFieldHelp.close();
			oClock.tick(iPopoverDuration); // fake closing time
			oClock.restore(); // as we need a timeout to test async Promise

			oFieldHelp.open(true); // suggestion
			assert.ok(FieldHelpBaseDelegate.contentRequest.called, "FieldHelpBaseDelegate.contentRequest called");
			assert.ok(FieldHelpBaseDelegate.contentRequest.calledWith(undefined, oFieldHelp, true), "FieldHelpBaseDelegate.contentRequest called with suggestion");
			oFieldHelp.skipOpening();
			setTimeout( function(){ // as promise is resolves async
				oClock = sinon.useFakeTimers(); // now we can use fake timer again
				assert.equal(iOpen, 0, "Open event not fired as promise is not resolved right now");
				assert.notOk(oPopover.openBy.called, "Popover not opened as promise is not resolved right now");
				oClock.tick(iPopoverDuration); // fake opening time

				oFieldHelp.close();
				oClock.tick(iPopoverDuration); // fake closing time
				FieldHelpBaseDelegate.contentRequest.restore();
				fnDone();
			}, 0);
		}, 0);

	});

	QUnit.test("getTextForKey with async contentRequest of delegate", function(assert) {

		oClock.restore(); // as we need a timeout to test async Promise
		var fnResolve;
		var oPromise = new Promise(function(fnMyResolve, fnMyReject) {
			fnResolve = fnMyResolve;
		});
		sinon.stub(FieldHelpBaseDelegate, "contentRequest").returns(oPromise);
		sinon.stub(oFieldHelp, "_getTextOrKey").returns("");
		oFieldHelp._getTextOrKey.withArgs("I1", true).returns("Item 1");
		oFieldHelp._getTextOrKey.withArgs("I2", true).returns({key: "I2", description: "Item 2", inParameters: {myTestIn: "In2"}, outParameters: {myTest: "Out2"}});
		oFieldHelp._getTextOrKey.withArgs("I3", true).returns(new Promise(function(fResolve) {fResolve({key: "I3", description: "Item 3", inParameters: {myTestIn: "In3"}, outParameters: {myTest: "Out3"}});}));
		oFieldHelp._getTextOrKey.withArgs("I4", true).returns(new Promise(function(fResolve) {throw new Error("wrong key");}));

		// different calls before promise is resolved
		var vResult1 = oFieldHelp.getTextForKey("I1");
		assert.ok(vResult1 instanceof Promise, "Test1: Promise returned");

		var vResult2 = oFieldHelp.getTextForKey("I1"); // same promise should be returned
		assert.equal(vResult1, vResult2, "Test2: Same promise returned for same request");

		var oContext = new Context(undefined, "test");
		var vResult3 = oFieldHelp.getTextForKey("I2", {testIn: "X"}, {test: "Y"}, oContext);
		assert.ok(vResult3 instanceof Promise, "Test3: Promise returned");

		var vResult4 = oFieldHelp.getTextForKey("I3");
		assert.ok(vResult4 instanceof Promise, "Test4: Promise returned");

		var vResult5 = oFieldHelp.getTextForKey("I4");
		assert.ok(vResult5 instanceof Promise, "Test5: Promise returned");

		var vResult6 = oFieldHelp.getTextForKey("Test");
		assert.ok(vResult6 instanceof Promise, "Test6: Promise returned");

		FieldHelpBaseDelegate.contentRequest.restore();
		fnResolve();
		var fnDone = assert.async();
		var iFinished = 0;

		vResult1.then(function(vResult) {
			assert.ok(true, "Test1+2: Promise Then must be called");
			assert.equal(vResult, "Item 1", "Test1+2: Text for key");
			iFinished++;
		}).catch(function(oError) {
			assert.notOk(true, "Test1+2: Promise Catch must not be called");
			iFinished++;
		});

		vResult3.then(function(vResult) {
			assert.ok(true, "Test3: Promise Then must be called");
			assert.equal(vResult.description, "Item 2", "Test3: Text for key");
			assert.deepEqual(vResult.inParameters, {myTestIn: "In2"} , "Test3: In-parameters in result");
			assert.deepEqual(vResult.outParameters, {myTest: "Out2"} , "Test3: Out-parameters in result");
			iFinished++;
		}).catch(function(oError) {
			assert.notOk(true, "Test3: Promise Catch must not be called");
			iFinished++;
		});

		vResult4.then(function(vResult) {
			assert.ok(true, "Test4: Promise Then must be called");
			assert.equal(vResult.description, "Item 3", "Test4: Text for key");
			assert.deepEqual(vResult.inParameters, {myTestIn: "In3"} , "Test4: In-parameters in result");
			assert.deepEqual(vResult.outParameters, {myTest: "Out3"} , "Test4: Out-parameters in result");
			iFinished++;
		}).catch(function(oError) {
			assert.notOk(true, "Test4: Promise Catch must not be called");
			iFinished++;
		});

		vResult5.then(function(vResult) {
			assert.notOk(true, "Test5: Promise Then must not be called");
			iFinished++;
		}).catch(function(oError) {
			assert.ok(true, "Test5: Promise Catch must be called");
			iFinished++;
		});

		vResult6.then(function(vResult) {
			assert.ok(true, "Test6: Promise Then must be called");
			assert.equal(vResult, "", "Test6: no text for key found");
			iFinished++;
		}).catch(function(oError) {
			assert.notOk(true, "Test6: Promise Catch must not be called");
			iFinished++;
		});

		setTimeout( function(){ // as promise is resolves async
			assert.equal(iFinished, 5, "All promises finished");
			fnDone();
		}, 0);

	});

	QUnit.test("getKeyForText with async contentRequest of delegate", function(assert) {

		oClock.restore(); // as we need a timeout to test async Promise
		var fnResolve;
		var oPromise = new Promise(function(fnMyResolve, fnMyReject) {
			fnResolve = fnMyResolve;
		});
		sinon.stub(FieldHelpBaseDelegate, "contentRequest").returns(oPromise);
		sinon.stub(oFieldHelp, "_getTextOrKey").returns("");
		oFieldHelp._getTextOrKey.withArgs("Item 1", false).returns("I1");
		oFieldHelp._getTextOrKey.withArgs("Item 2", false).returns({key: "I2", description: "Item 2", inParameters: {myTestIn: "In2"}, outParameters: {myTest: "Out2"}});
		oFieldHelp._getTextOrKey.withArgs("Item 3", false).returns(new Promise(function(fResolve) {fResolve({key: "I3", description: "Item 3", inParameters: {myTestIn: "In3"}, outParameters: {myTest: "Out3"}});}));
		oFieldHelp._getTextOrKey.withArgs("Item 4", false).returns(new Promise(function(fResolve) {throw new Error("wrong key");}));

		// different calls before promise is resolved
		var vResult1 = oFieldHelp.getKeyForText("Item 1");
		assert.ok(vResult1 instanceof Promise, "Test1: Promise returned");

		var vResult2 = oFieldHelp.getKeyForText("Item 1"); // same promise should be returned
		assert.equal(vResult1, vResult2, "Test2: Same promise returned for same request");

		var vResult3 = oFieldHelp.getKeyForText("Item 2");
		assert.ok(vResult3 instanceof Promise, "Test3: Promise returned");

		var vResult4 = oFieldHelp.getKeyForText("Item 3");
		assert.ok(vResult4 instanceof Promise, "Test4: Promise returned");

		var vResult5 = oFieldHelp.getKeyForText("Item 4");
		assert.ok(vResult5 instanceof Promise, "Test5: Promise returned");

		var vResult6 = oFieldHelp.getKeyForText("X");
		assert.ok(vResult6 instanceof Promise, "Test6: Promise returned");

		FieldHelpBaseDelegate.contentRequest.restore();
		fnResolve();
		var fnDone = assert.async();
		var iFinished = 0;

		vResult1.then(function(vResult) {
			assert.ok(true, "Test1+2: Promise Then must be called");
			assert.equal(vResult, "I1", "Test1+2: key for text");
			iFinished++;
		}).catch(function(oError) {
			assert.notOk(true, "Test1+2: Promise Catch must not be called");
			iFinished++;
		});

		vResult3.then(function(vResult) {
			assert.ok(true, "Test3: Promise Then must be called");
			assert.equal(vResult.key, "I2", "Test3: key for text");
			assert.deepEqual(vResult.inParameters, {myTestIn: "In2"} , "Test3: In-parameters in result");
			assert.deepEqual(vResult.outParameters, {myTest: "Out2"} , "Test3: Out-parameters in result");
			iFinished++;
		}).catch(function(oError) {
			assert.notOk(true, "Test3: Promise Catch must not be called");
			iFinished++;
		});

		vResult4.then(function(vResult) {
			assert.ok(true, "Test4: Promise Then must be called");
			assert.equal(vResult.key, "I3", "Test4: key for text");
			assert.deepEqual(vResult.inParameters, {myTestIn: "In3"} , "Test4: In-parameters in result");
			assert.deepEqual(vResult.outParameters, {myTest: "Out3"} , "Test4: Out-parameters in result");
			iFinished++;
		}).catch(function(oError) {
			assert.notOk(true, "Test4: Promise Catch must not be called");
			iFinished++;
		});

		vResult5.then(function(vResult) {
			assert.notOk(true, "Test5: Promise Then must not be called");
			iFinished++;
		}).catch(function(oError) {
			assert.ok(true, "Test5: Promise Catch must be called");
			iFinished++;
		});

		vResult6.then(function(vResult) {
			assert.ok(true, "Test6: Promise Then must be called");
			assert.notOk(vResult, "Test6: key for not existing text");
			iFinished++;
		}).catch(function(oError) {
			assert.notOk(true, "Test6: Promise Catch must not be called");
			iFinished++;
		});

		setTimeout( function(){ // as promise is resolves async
			assert.equal(iFinished, 5, "All promises finished");
			fnDone();
		}, 0);

	});

	QUnit.module("delegate async", {
		beforeEach: function() {
			sinon.stub(sap.ui, "require");
			sap.ui.require.withArgs("sap/ui/mdc/field/FieldHelpBaseDelegate").onFirstCall().returns(undefined);
			sap.ui.require.callThrough();

			oFieldHelp = new FieldHelpBase("F1-H", {
				disconnect: _myDisconnectHandler,
				open: _myOpenHandler
			});
			_initFields();
		},
		afterEach: function() {
			sap.ui.require.restore();
			_teardown();
		}
	});

	QUnit.test("open", function(assert) {

		oClock.restore(); // as we need a timeout to test async Promise
		sinon.spy(FieldHelpBaseDelegate, "contentRequest");

		oFieldHelp.connect(oField);
		oFieldHelp.open(); // no suggestion

		var oPopover = oFieldHelp.getAggregation("_popover");
		sinon.spy(oPopover, "openBy");

		assert.notOk(FieldHelpBaseDelegate.contentRequest.called, "FieldHelpBaseDelegate.contentRequest not called before delegate loaded");
		assert.equal(iOpen, 0, "Open event not fired before delegate loaded");
		assert.notOk(oPopover.openBy.called, "Popover not opened before delegate loaded");

		var fnDone = assert.async();
		setTimeout( function(){ // to wait until delegate loaded
			oClock = sinon.useFakeTimers(); // now we can use fake timer again
			oClock.tick(iPopoverDuration); // fake opening time
			assert.ok(FieldHelpBaseDelegate.contentRequest.called, "FieldHelpBaseDelegate.contentRequest called after delegate loaded");
			assert.equal(iOpen, 1, "Open event fired after delegate loaded");
			assert.ok(oPopover.openBy.called, "Popover opened after delegate loaded");
			oFieldHelp.close();
			oClock.tick(iPopoverDuration); // fake closing time
			fnDone();
		}, 0);

	});

});
