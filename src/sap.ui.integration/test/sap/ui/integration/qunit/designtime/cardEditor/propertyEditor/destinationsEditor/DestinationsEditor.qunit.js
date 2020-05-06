/* global QUnit */

sap.ui.define([
	"sap/ui/integration/designtime/baseEditor/BaseEditor",
	"sap/ui/thirdparty/sinon-4"
], function (
	BaseEditor,
	sinon
) {
	"use strict";

	var sandbox = sinon.sandbox.create();

	function _getComplexMapEditors (oEditor) {
		// Return the property keys of each complex editor value with the respective editors which were created
		var aComplexMapItems = oEditor.getContent().getItems()[0].getItems();
		return aComplexMapItems.map(function (oDestinations) {
			var aNestedComplexMapEditors = {};
			var oArrayEditor = oEditor.getConfig().collapsibleItems === false
				? oDestinations.getItems()[1]
				: oDestinations.getContent()[0];
			oArrayEditor._getPropertyEditors().forEach(function (oPropertyEditor) {
				var sPropertyName = oPropertyEditor.getConfig().path.split("/")[1];
				aNestedComplexMapEditors[sPropertyName] = oPropertyEditor;
			});
			return aNestedComplexMapEditors;
		});
	}

	function _createBaseEditorConfig(mConfigOptions) {
		return {
			context: "/",
			properties: {
				"sampleDestination": Object.assign({
					"label": "Data Sources",
					"type": "destinations",
					"itemLabel": "Data Source",
					"path": "destinations"
				}, mConfigOptions)
			},
			propertyEditors: {
				"destinations": "sap/ui/integration/designtime/cardEditor/propertyEditor/destinationsEditor/DestinationsEditor",
				"array": "sap/ui/integration/designtime/baseEditor/propertyEditor/arrayEditor/ArrayEditor",
				"string": "sap/ui/integration/designtime/baseEditor/propertyEditor/stringEditor/StringEditor",
				"enum": "sap/ui/integration/designtime/baseEditor/propertyEditor/enumStringEditor/EnumStringEditor"
			}
		};
	}

	QUnit.module("Developer scenario", {
		before: function () {
			this.oDestinations = {
				destinations: {
					sampleDestination: {
						name: "MySampleDestination"
					},
					anotherDestination: {
						name: "AnotherDestination",
						label: "Hello World"
					}
				}
			};
		},
		beforeEach: function () {
			var mConfig = _createBaseEditorConfig();

			this.oBaseEditor = new BaseEditor({
				config: mConfig,
				json: this.oDestinations
			});
			this.oBaseEditor.placeAt("qunit-fixture");

			return this.oBaseEditor.getPropertyEditorsByName("sampleDestination").then(function (aPropertyEditor) {
				this.oDestinationsEditor = aPropertyEditor[0];
				this.oNestedArrayEditor = this.oDestinationsEditor.getContent();
			}.bind(this));
		},
		afterEach: function () {
			this.oBaseEditor.destroy();
			sandbox.restore();
		}
	}, function () {
		QUnit.test("When an editor is created", function (assert) {
			var oDestinationsEditorDomRef = this.oDestinationsEditor.getDomRef();
			assert.ok(oDestinationsEditorDomRef instanceof HTMLElement, "Then it is rendered correctly (1/3)");
			assert.ok(oDestinationsEditorDomRef.offsetHeight > 0, "Then it is rendered correctly (2/3)");
			assert.ok(oDestinationsEditorDomRef.offsetWidth > 0, "Then it is rendered correctly (3/3)");
		});

		QUnit.test("When config and json data were set", function (assert) {
			assert.deepEqual(
				this.oNestedArrayEditor.getValue(),
				[
					{
						name: "MySampleDestination",
						key: "sampleDestination"
					},
					{
						name: "AnotherDestination",
						label: "Hello World",
						key: "anotherDestination"
					}
				],
				"Then the editor value is properly converted to an array"
			);
		});

		QUnit.test("When a label was set", function (assert) {
			assert.strictEqual(
				_getComplexMapEditors(this.oNestedArrayEditor)[1].label.getValue(),
				"Hello World",
				"Then it is used in the editor"
			);
		});
	});

	QUnit.module("Configuration options", {
		beforeEach: function () {
			var mJson = {
				destinations: {
					sampleDestination: {
						name: "abc"
					}
				}
			};
			this.oBaseEditor = new BaseEditor({
				json: mJson
			});
			this.oBaseEditor.placeAt("qunit-fixture");
		},
		afterEach: function () {
			this.oBaseEditor.destroy();
		}
	}, function () {
		QUnit.test("When allowed values are set", function (assert) {
			var mConfig = _createBaseEditorConfig({
				allowKeyChange: false,
				allowedValues: ["abc", "def"]
			});
			this.oBaseEditor.setConfig(mConfig);

			return this.oBaseEditor.getPropertyEditorsByName("sampleDestination").then(function (aPropertyEditor) {
				var oDestinationsEditor = aPropertyEditor[0];
				sap.ui.getCore().applyChanges();
				var oNestedArrayEditor = oDestinationsEditor.getContent();
				return oNestedArrayEditor.ready().then(function () {
					var oComplexEditors = _getComplexMapEditors(oNestedArrayEditor)[0];
					assert.deepEqual(Object.keys(oComplexEditors), ["name"], "Then only the name field is editable");

					assert.deepEqual(
						oComplexEditors.name.getConfig().enum,
						mConfig.properties.sampleDestination.allowedValues,
						"Then only the allowed destinations are available in the name selection"
					);
				});
			});
		});
	});

	QUnit.done(function () {
		document.getElementById("qunit-fixture").style.display = "none";
	});
});