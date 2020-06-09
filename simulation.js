"use strict";
// See https://github.com/safetyscore/simulation for the source repo.
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var _a, _b;
// Determine host environment.
var IN_BROWSER = typeof self === "object";
var IN_WORKER = typeof importScripts === "function";
// Attribute values for clusters.
var CLUSTER_PUBLIC = 1;
var CLUSTER_SAFEGUARDED = 2;
// Time spent in clusters during a day.
var CLUSTER_PERIODS = 8;
// User interface colours.
var COLOUR_DEAD = "#000000";
var COLOUR_HEALTHY = "#8bb4b8";
var COLOUR_INFECTED = "#ff3945";
var COLOUR_RECOVERED = "#009d51";
// Intervention methods.
var METHOD_APPLE_GOOGLE = 1;
var METHOD_FREE_MOVEMENT = 2;
var METHOD_LOCKDOWN = 3;
var METHOD_SAFETYSCORE = 4;
// Method colours for use in graphs.
var METHOD_COLOURS = (_a = {},
    _a[METHOD_APPLE_GOOGLE] = COLOUR_INFECTED,
    _a[METHOD_FREE_MOVEMENT] = COLOUR_HEALTHY,
    _a[METHOD_LOCKDOWN] = "#444444",
    _a[METHOD_SAFETYSCORE] = COLOUR_RECOVERED,
    _a);
// Short method labels for use in graphs.
var METHOD_LABELS = (_b = {},
    _b[METHOD_APPLE_GOOGLE] = "Apple/Google",
    _b[METHOD_FREE_MOVEMENT] = "Free Movement",
    _b[METHOD_LOCKDOWN] = "Lockdown",
    _b[METHOD_SAFETYSCORE] = "SafetyScore",
    _b);
// Attribute values for people.
var PERSON_APP_FOREIGN_CLUSTER = 1;
var PERSON_APP_INSTALLED = 2;
var PERSON_APP_OWN_CLUSTER = 4;
var PERSON_KEY_WORKER = 8;
var PERSON_SYMPTOMATIC = 16;
// Sort orders.
var SORT_ASCENDING = 1;
var SORT_DESCENDING = 2;
// Status values.
var STATUS_HEALTHY = 1;
var STATUS_INFECTED = 2;
var STATUS_CONTAGIOUS = 4;
var STATUS_RECOVERED = 8;
var STATUS_IMMUNE = 16;
var STATUS_DEAD = 32;
var STATUS_ISOLATED = 64;
var STATUS_QUARANTINED = 128;
// SVG namespace.
var SVG = "http://www.w3.org/2000/svg";
// Visual ordering of methods.
var METHODS = [
    METHOD_FREE_MOVEMENT,
    METHOD_APPLE_GOOGLE,
    METHOD_SAFETYSCORE,
    METHOD_LOCKDOWN,
];
var ctrl;
var overlayShown = false;
var parentPort;
var $config;
var $mirror;
var AbstractedWorker = /** @class */ (function () {
    function AbstractedWorker(src) {
        if (IN_BROWSER) {
            this.worker = new Worker(src);
        }
        else {
            var Worker_1 = require("worker_threads").Worker;
            this.worker = new Worker_1(src);
        }
    }
    AbstractedWorker.prototype.onMessage = function (handler) {
        if (IN_BROWSER) {
            this.worker.onmessage = function (e) {
                handler(e.data);
            };
        }
        else {
            this.worker.on("message", handler);
        }
    };
    AbstractedWorker.prototype.postMessage = function (req) {
        this.worker.postMessage(req);
    };
    AbstractedWorker.prototype.terminate = function () {
        this.worker.terminate();
    };
    return AbstractedWorker;
}());
var BarChart = /** @class */ (function () {
    function BarChart(ctrl) {
        this.ctrl = ctrl;
        this.data = {};
        this.dirty = true;
        this.height = 300;
        this.labelHeight = 40;
        this.padLabel = 25;
        this.padLeft = 60;
        this.padTop = 25;
        this.top = this.height - this.labelHeight + 1;
        this.inner = this.top - this.padTop;
        this.width = 0;
    }
    BarChart.prototype.drawBars = function ($graph, font, key, label, midX) {
        // Draw the X-axis label.
        addNode($graph, "text", {
            "alignment-baseline": "middle",
            "font-family": font,
            "font-size": "12px",
            "text-anchor": "middle",
            x: midX,
            y: this.height - this.labelHeight + this.padLabel,
        }).innerHTML = label;
        // Draw the bars for the different methods.
        var start = midX - 160;
        for (var i = 0; i < METHODS.length; i++) {
            var method = METHODS[i];
            var data = this.data[method];
            if (typeof data === "undefined") {
                continue;
            }
            var median = data[key].median;
            var height = Math.round((median / 100) * this.inner);
            var posX = start + i * 80;
            var posY = this.top - height;
            addNode($graph, "rect", {
                fill: METHOD_COLOURS[method],
                height: height,
                width: 50,
                x: posX,
                y: posY,
            });
            addNode($graph, "text", {
                "alignment-baseline": "middle",
                "font-family": font,
                "font-size": "11px",
                "text-anchor": "middle",
                x: posX + 25,
                y: posY - 12,
            }).innerHTML = METHOD_LABELS[method];
        }
    };
    BarChart.prototype.downloadGraph = function (format) {
        var filename = this.getFilename(format);
        var height = this.height;
        var width = 840;
        var graph = document.createElementNS(SVG, "svg");
        graph.setAttribute("height", "100%");
        graph.setAttribute("viewBox", "0 0 " + width + " " + height);
        graph.setAttribute("width", "100%");
        this.generateGraph(graph, height, width);
        var svg = new XMLSerializer().serializeToString(graph);
        downloadImage({ filename: filename, format: format, height: height, svg: svg, width: width });
    };
    BarChart.prototype.generateGraph = function ($graph, height, width) {
        addNode($graph, "rect", {
            fill: "#fff",
            height: height,
            width: width,
            x: 0,
            y: 0,
        });
        var font = this.ctrl.cfg.imageFont;
        var midX = Math.floor((width - this.padLeft) / 4);
        var segment = midX * 2;
        var ventile = (height - this.labelHeight - this.padTop) / 5;
        // Draw the Y-axis labels.
        var posY = this.padTop;
        for (var i = 5; i >= 0; i--) {
            addNode($graph, "text", {
                "alignment-baseline": "middle",
                "font-family": font,
                "font-size": "12px",
                "text-anchor": "end",
                x: 40,
                y: posY + 2,
            }).innerHTML = "" + i * 20;
            addNode($graph, "rect", {
                x: 48,
                y: posY,
                width: 5,
                height: 1,
            });
            posY += ventile;
        }
        // Draw the Y-axis line.
        posY = posY - ventile + 1;
        addNode($graph, "rect", {
            x: 53,
            y: this.padTop,
            width: 1,
            height: posY - this.padTop,
        });
        // Draw the info on healthy.
        this.drawBars($graph, font, "healthy", "Healthy", midX + this.padLeft);
        // Draw the info on isolated.
        this.drawBars($graph, font, "isolated", "Isolated", segment + midX + this.padLeft);
    };
    BarChart.prototype.getFilename = function (ext) {
        return "simulation-overview-" + Date.now() + "." + ext;
    };
    BarChart.prototype.markDirty = function () {
        this.dirty = true;
        this.ctrl.requestRedraw();
    };
    BarChart.prototype.render = function () {
        if (overlayShown || !this.dirty) {
            return;
        }
        this.dirty = false;
        this.renderGraph();
    };
    BarChart.prototype.renderGraph = function () {
        var $graph = this.$graph;
        $graph.innerHTML = "";
        this.generateGraph($graph, this.height, this.width);
    };
    BarChart.prototype.setDimensions = function () {
        if (!IN_BROWSER) {
            return;
        }
        var width = this.$root.offsetWidth;
        if (width < 800) {
            width = 800;
        }
        var buffer = 238;
        if (width > 800 + 238) {
            this.$content.style.paddingLeft = buffer + "px";
            width -= buffer;
        }
        else {
            this.$content.style.paddingLeft = "0px";
        }
        this.$graph.setAttribute("viewBox", "0 0 " + width + " " + this.height);
        this.width = width;
        this.markDirty();
    };
    BarChart.prototype.setupUI = function () {
        var _this = this;
        var $downloadPNG = (h("div", { class: "action" },
            h("img", { src: "download.svg", alt: "Download" }),
            h("span", null, "Download PNG")));
        $downloadPNG.addEventListener("click", function () { return _this.downloadGraph("png"); });
        var $downloadSVG = (h("div", { class: "action" },
            h("img", { src: "svg.svg", alt: "svg" }),
            h("span", null, "Download SVG")));
        $downloadSVG.addEventListener("click", function () { return _this.downloadGraph("svg"); });
        var $graph = document.createElementNS(SVG, "svg");
        $graph.setAttribute("height", "" + this.height);
        $graph.setAttribute("preserveAspectRatio", "none");
        $graph.setAttribute("viewBox", "0 0 " + this.width + " " + this.height);
        $graph.setAttribute("width", "100%");
        var $content = h("div", { class: "content" }, $graph);
        var $root = (h("div", { class: "simulation" },
            h("div", { class: "heading" }),
            $downloadSVG,
            $downloadPNG,
            h("div", { class: "clear" }),
            $content,
            h("div", { class: "clear" })));
        this.$content = $content;
        this.$graph = $graph;
        this.$root = $root;
        return $root;
    };
    BarChart.prototype.update = function (method, info) {
        this.dirty = true;
        if (info) {
            this.data[method] = info;
        }
        else {
            delete this.data[method];
        }
    };
    return BarChart;
}());
var Comparison = /** @class */ (function () {
    function Comparison(ctrl, key, label, sort) {
        this.ctrl = ctrl;
        this.data = {};
        this.dirty = false;
        this.height = 300;
        this.key = key;
        this.label = label;
        this.max = 0;
        this.sort = sort;
        this.width = 0;
    }
    Comparison.prototype.downloadGraph = function (format) {
        var filename = this.getFilename(format);
        var height = 300;
        var width = 760;
        var graph = document.createElementNS(SVG, "svg");
        graph.setAttribute("height", "100%");
        graph.setAttribute("viewBox", "0 0 " + width + " " + height);
        graph.setAttribute("width", "100%");
        this.generateGraph(graph, height, width);
        var svg = new XMLSerializer().serializeToString(graph);
        downloadImage({ filename: filename, format: format, height: height, svg: svg, width: width });
    };
    Comparison.prototype.generateGraph = function ($graph, height, width) {
        addNode($graph, "rect", {
            fill: "#eeeeee",
            height: height,
            width: width,
            x: 0,
            y: 0,
        });
        if (this.max === 0) {
            return;
        }
        var font = this.ctrl.cfg.imageFont;
        var methodLabelHeight = 30;
        var padMethodLabel = 15;
        var padLeft = 60;
        var padTop = 25;
        var midX = Math.floor((width - padLeft) / 8);
        var segment = midX * 2;
        var ventiles = Math.ceil(this.max / 20);
        var ventile = (height - methodLabelHeight - padTop) / ventiles;
        // Draw the Y-axis labels.
        var posY = padTop;
        for (var i = ventiles; i >= 0; i--) {
            addNode($graph, "text", {
                "alignment-baseline": "middle",
                "font-family": font,
                "font-size": "12px",
                "text-anchor": "end",
                x: 40,
                y: posY + 2,
            }).innerHTML = "" + i * 20;
            addNode($graph, "rect", {
                x: 48,
                y: posY,
                width: 5,
                height: 1,
            });
            posY += ventile;
        }
        // Draw the Y-axis line.
        posY = posY - ventile + 1;
        addNode($graph, "rect", {
            x: 53,
            y: padTop,
            width: 1,
            height: posY - padTop,
        });
        var top = height - methodLabelHeight;
        var y = top - padTop;
        for (var i = 0; i < METHODS.length; i++) {
            var method = METHODS[i];
            var box = this.data[method];
            if (typeof box === "undefined") {
                continue;
            }
            // Draw the X-axis label.
            var mid = i * segment + midX + padLeft;
            addNode($graph, "text", {
                "alignment-baseline": "middle",
                "font-family": font,
                "font-size": "12px",
                "text-anchor": "middle",
                x: mid,
                y: height - methodLabelHeight + padMethodLabel,
            }).innerHTML = METHOD_LABELS[method];
            // Draw the median.
            var medianY = top - y * (box.median / 100);
            addNode($graph, "rect", {
                x: mid - 9,
                y: medianY,
                width: 20,
                height: 3,
            });
            // Label the median.
            addNode($graph, "text", {
                "alignment-baseline": "middle",
                "font-family": font,
                "font-size": "12px",
                x: mid + 20,
                y: medianY + 2,
            }).innerHTML = decimal(box.median) + "%";
            // Draw the top whisker.
            var rheight = Math.max(1, y * ((box.max - box.q3) / 100));
            var topY = top - y * (box.max / 100);
            if (medianY - topY > 2) {
                addNode($graph, "rect", {
                    x: mid,
                    y: topY,
                    width: 2,
                    height: rheight,
                });
            }
            // Draw the bottom whisker.
            var bottomY = top - y * (box.q1 / 100);
            rheight = Math.max(1, y * ((box.q1 - box.min) / 100));
            if (bottomY + rheight - medianY > 5) {
                addNode($graph, "rect", {
                    x: mid,
                    y: bottomY,
                    width: 2,
                    height: rheight,
                });
            }
        }
    };
    Comparison.prototype.getFilename = function (ext) {
        return "simulation-" + this.key + "-" + Date.now() + "." + ext;
    };
    Comparison.prototype.hideInfo = function () {
        if (this.handle) {
            clearTimeout(this.handle);
            this.handle = undefined;
        }
        hide(this.$info);
    };
    Comparison.prototype.markDirty = function () {
        this.dirty = true;
        this.ctrl.requestRedraw();
    };
    Comparison.prototype.render = function () {
        if (!IN_BROWSER) {
            return;
        }
        if (overlayShown || !this.dirty) {
            return;
        }
        this.dirty = false;
        this.renderSummary();
        this.renderGraph();
    };
    Comparison.prototype.renderGraph = function () {
        var $graph = this.$graph;
        $graph.innerHTML = "";
        this.generateGraph($graph, this.height, this.width);
    };
    Comparison.prototype.renderInfo = function (e) {
        var _this = this;
        var bounds = this.$graph.getBoundingClientRect();
        var padLeft = 60;
        var pos = e.clientX - bounds.left;
        if (pos < padLeft || pos > this.width) {
            if (this.handle) {
                this.hideInfo();
            }
            return;
        }
        var segment = (this.width - padLeft) / METHODS.length;
        var idx = Math.floor((pos - padLeft) / segment);
        var method = METHODS[idx];
        if (this.handle) {
            clearTimeout(this.handle);
            this.handle = undefined;
        }
        var box = this.data[method];
        if (typeof box === "undefined") {
            this.hideInfo();
            return;
        }
        var $info = (h("div", { class: "info" },
            h("div", { class: "pad-bottom" },
                h("strong", null, METHOD_LABELS[method])),
            h("div", null,
                "Maximum",
                h("div", { class: "right value-" + this.key },
                    decimal(box.max),
                    "%")),
            h("div", null,
                "3",
                h("sup", null, "rd"),
                " Quartile",
                h("div", { class: "right value-" + this.key },
                    decimal(box.q3),
                    "%")),
            h("div", null,
                "Median",
                h("div", { class: "right value-" + this.key },
                    decimal(box.median),
                    "%")),
            h("div", null,
                "1",
                h("sup", null, "st"),
                " Quartile",
                h("div", { class: "right value-" + this.key },
                    decimal(box.q1),
                    "%")),
            h("div", null,
                "Minimum",
                h("div", { class: "right value-" + this.key },
                    decimal(box.min),
                    "%"))));
        this.$info.replaceWith($info);
        this.$info = $info;
        show(this.$info);
        this.handle = setTimeout(function () { return _this.hideInfo(); }, 2400);
    };
    Comparison.prototype.renderSummary = function () {
        var $summary = h("div", { class: "summary" });
        var data = [];
        for (var i = 0; i < METHODS.length; i++) {
            var method = METHODS[i];
            var box = this.data[method];
            if (typeof box === "undefined") {
                continue;
            }
            data.push({ label: METHOD_LABELS[method], value: box.median });
        }
        if (data.length === 0) {
            $summary.appendChild(h("div", null, "Calculating ..."));
        }
        else {
            if (this.sort === SORT_ASCENDING) {
                data.sort(function (a, b) { return a.value - b.value; });
            }
            else if (this.sort === SORT_DESCENDING) {
                data.sort(function (a, b) { return b.value - a.value; });
            }
            for (var i = 0; i < data.length; i++) {
                var info = data[i];
                $summary.appendChild(h("div", { class: "pad-bottom" },
                    info.label,
                    h("div", { class: "right value-" + this.key },
                        decimal(info.value),
                        "%")));
            }
        }
        this.$summary.replaceWith($summary);
        this.$summary = $summary;
    };
    Comparison.prototype.reset = function () {
        this.data = {};
        this.dirty = true;
        this.max = 0;
    };
    Comparison.prototype.setDimensions = function () {
        if (!IN_BROWSER) {
            return;
        }
        var width = this.$root.offsetWidth - this.$summary.offsetWidth;
        if (width < 200) {
            width = 200;
        }
        if (width === this.width) {
            return;
        }
        this.$graph.setAttribute("height", "" + this.height);
        this.$graph.setAttribute("width", "" + width);
        this.$graph.setAttribute("viewBox", "0 0 " + width + " " + this.height);
        this.width = width;
        this.markDirty();
    };
    Comparison.prototype.setupUI = function () {
        var _this = this;
        var $downloadPNG = (h("div", { class: "action" },
            h("img", { src: "download.svg", alt: "Download" }),
            h("span", null, "Download PNG")));
        $downloadPNG.addEventListener("click", function () { return _this.downloadGraph("png"); });
        var $downloadSVG = (h("div", { class: "action" },
            h("img", { src: "svg.svg", alt: "svg" }),
            h("span", null, "Download SVG")));
        $downloadSVG.addEventListener("click", function () { return _this.downloadGraph("svg"); });
        var $graph = document.createElementNS(SVG, "svg");
        $graph.addEventListener("mousemove", function (e) { return _this.renderInfo(e); });
        $graph.addEventListener("mouseout", function () { return _this.hideInfo(); });
        $graph.setAttribute("preserveAspectRatio", "none");
        $graph.setAttribute("viewBox", "0 0 " + this.width + " " + this.height);
        var $info = h("div", { class: "info" });
        var $summary = h("div", { class: "summary" });
        var $content = (h("div", { class: "content" },
            h("div", { class: "graph-holder" },
                $info,
                $summary,
                h("div", { class: "graph" }, $graph)),
            h("div", { class: "clear" })));
        var $root = (h("div", { class: "simulation" },
            h("div", { class: "heading" },
                "Comparison of % ",
                this.label),
            $downloadSVG,
            $downloadPNG,
            h("div", { class: "clear" }),
            $content));
        this.$graph = $graph;
        this.$info = $info;
        this.$root = $root;
        this.$summary = $summary;
        return $root;
    };
    Comparison.prototype.update = function (method, info) {
        this.dirty = true;
        if (info) {
            if (info.max > this.max) {
                this.max = info.max;
            }
            this.data[method] = info;
        }
        else {
            delete this.data[method];
        }
    };
    return Comparison;
}());
var ConfigValidator = /** @class */ (function () {
    function ConfigValidator(cfg) {
        this.cfg = cfg;
        this.seen = new Set();
    }
    ConfigValidator.prototype.checkFields = function () {
        var fields = Object.keys(this.cfg);
        var seen = this.seen;
        for (var i = 0; i < fields.length; i++) {
            var field = fields[i];
            if (!seen.has(field)) {
                throw "Config has field \"" + field + "\" which hasn't been validated";
            }
        }
    };
    ConfigValidator.prototype.validate = function (fields, validator) {
        var _this = this;
        fields.forEach(function (field) {
            _this.seen.add(field);
            var val = _this.cfg[field];
            if (val === undefined) {
                throw "The value for \"" + field + "\" cannot be undefined";
            }
            validator(field, val);
        });
    };
    ConfigValidator.prototype.validateBoolean = function (fields) {
        this.validate(fields, function (field, val) {
            if (typeof val !== "boolean") {
                throw "The value for \"" + field + "\" must be a boolean";
            }
        });
    };
    ConfigValidator.prototype.validateDistribution = function (fields) {
        this.validate(fields, function (field, val) {
            if (!val.sample) {
                throw "The value for \"" + field + "\" must be a Distribution";
            }
        });
    };
    ConfigValidator.prototype.validateNumber = function (min, fields) {
        this.validate(fields, function (field, val) {
            if (typeof val !== "number") {
                throw "The value for \"" + field + "\" must be a number";
            }
            if (Math.floor(val) !== val) {
                throw "The value for \"" + field + "\" must be a whole number";
            }
            if (val < min) {
                throw "The value for \"" + field + "\" must be greater than " + min;
            }
        });
    };
    ConfigValidator.prototype.validatePercentage = function (fields) {
        this.validate(fields, function (field, val) {
            if (typeof val !== "number") {
                throw "The value for \"" + field + "\" must be a number";
            }
            if (val < 0 || val > 1) {
                throw "The value for \"" + field + "\" must be between 0 and 1";
            }
        });
    };
    ConfigValidator.prototype.validateScore = function (fields) {
        this.validate(fields, function (field, val) {
            if (typeof val !== "number") {
                throw "The value for \"" + field + "\" must be a number";
            }
            if (Math.floor(val) !== val) {
                throw "The value for \"" + field + "\" must be a whole number";
            }
            if (val < 0 || val > 100) {
                throw "The value for \"" + field + "\" must be between 0 and 100";
            }
        });
    };
    ConfigValidator.prototype.validateString = function (fields) {
        this.validate(fields, function (field, val) {
            if (typeof val !== "string") {
                throw "The value for \"" + field + "\" must be a string";
            }
        });
    };
    ConfigValidator.prototype.validateStringValue = function (field, values) {
        this.seen.add(field);
        var val = this.cfg[field];
        if (val === undefined) {
            throw "The value for \"" + field + "\" cannot be undefined";
        }
        if (!includes(values, val)) {
            throw "Invalid value for \"" + field + "\"";
        }
    };
    return ConfigValidator;
}());
var Controller = /** @class */ (function () {
    function Controller() {
        var cfg = defaultConfig();
        cfg.runsMax = 1;
        cfg.runsMin = 1;
        this.cfg = cfg;
        this.cmps = [];
        this.definition = defaultConfigDefinition();
        this.rand = 1591652858676;
        this.paused = false;
        this.simList = [];
        this.sims = {};
    }
    Controller.prototype.init = function (methods, setupUI) {
        for (var i = 0; i < methods.length; i++) {
            var method = methods[i];
            var sim = new Simulation(this, method);
            if (setupUI) {
                this.$main.appendChild(sim.setupUI());
            }
            this.simList.push(sim);
            this.sims[method] = sim;
        }
        var barchart = new BarChart(this);
        var healthy = new Comparison(this, "healthy", "Healthy", SORT_DESCENDING);
        var isolated = new Comparison(this, "isolated", "Isolated", SORT_ASCENDING);
        if (setupUI) {
            this.$main.appendChild(barchart.setupUI());
            this.$main.appendChild(healthy.setupUI());
            this.$main.appendChild(isolated.setupUI());
        }
        this.barchart = barchart;
        this.cmps.push(healthy);
        this.cmps.push(isolated);
    };
    Controller.prototype.initBrowser = function () {
        this.$main = $("main");
        this.init(METHODS, true);
        this.setDimensions();
        this.run();
        this.redraw();
    };
    Controller.prototype.initNodeJS = function (method) {
        var cfg = this.cfg;
        this.init([method], false);
        this.run();
    };
    Controller.prototype.pause = function () {
        this.paused = true;
    };
    Controller.prototype.randomise = function () {
        this.rand = Date.now();
        console.log("Using random seed: " + this.rand);
        this.run();
    };
    Controller.prototype.redraw = function () {
        if (!this.paused) {
            for (var i = 0; i < this.simList.length; i++) {
                this.simList[i].render();
            }
            for (var i = 0; i < this.cmps.length; i++) {
                this.cmps[i].render();
            }
        }
        this.barchart.render();
        this.handle = 0;
    };
    Controller.prototype.requestRedraw = function () {
        var _this = this;
        if (!IN_BROWSER) {
            return;
        }
        if (this.handle) {
            return;
        }
        this.handle = requestAnimationFrame(function () { return _this.redraw(); });
    };
    Controller.prototype.resetComparison = function () {
        for (var i = 0; i < this.cmps.length; i++) {
            this.cmps[i].reset();
        }
        this.requestRedraw();
    };
    Controller.prototype.resume = function () {
        this.paused = false;
        this.requestRedraw();
    };
    Controller.prototype.run = function () {
        this.resetComparison();
        for (var i = 0; i < this.simList.length; i++) {
            var sim = this.simList[i];
            if (!sim.hidden) {
                sim.run(this.cfg, this.definition, this.rand);
            }
        }
    };
    Controller.prototype.runNew = function (cfg, definition) {
        this.cfg = cfg;
        this.definition = definition;
        this.rand = Date.now();
        this.run();
    };
    Controller.prototype.setDimensions = function () {
        if (!IN_BROWSER) {
            return;
        }
        for (var i = 0; i < this.simList.length; i++) {
            this.simList[i].setDimensions();
        }
        for (var i = 0; i < this.cmps.length; i++) {
            this.cmps[i].setDimensions();
        }
        this.barchart.setDimensions();
    };
    Controller.prototype.updateComparison = function (method, info) {
        if (info) {
            for (var i = 0; i < this.cmps.length; i++) {
                var cmp = this.cmps[i];
                cmp.update(method, info[cmp.key]);
            }
        }
        else {
            for (var i = 0; i < this.cmps.length; i++) {
                this.cmps[i].update(method);
            }
        }
        this.barchart.update(method, info);
        this.requestRedraw();
    };
    return Controller;
}());
var Model = /** @class */ (function () {
    function Model() {
    }
    Model.prototype.createRNG = function () {
        var rand = this.rand;
        return {
            additionalCluster: new RNG("additionalCluster-" + rand),
            appInstalled: new RNG("appInstalled-" + rand),
            clusterCount: new RNG("clusterCount-" + rand),
            clusterSize: new RNG("clusterSize-" + rand),
            exposedVisit: new RNG("exposedVisit-" + rand),
            fatality: new RNG("fatality-" + rand),
            foreign: new RNG("foreign-" + rand),
            groupSize: new RNG("groupSize-" + rand),
            household: new RNG("household-" + rand),
            illness: new RNG("illness-" + rand),
            immunity: new RNG("immunity-" + rand),
            infect: new RNG("infect-" + rand),
            init: new RNG("init-" + rand),
            installForeign: new RNG("installForeign-" + rand),
            installOwn: new RNG("installOwn-" + rand),
            isolationEffectiveness: new RNG("isolationEffectiveness-" + rand),
            isolationLikelihood: new RNG("isolationLikelihood-" + rand),
            isolationLockdown: new RNG("isolationLockdown-" + rand),
            isolationSymptomatic: new RNG("isolationSymptomatic-" + rand),
            keyWorker: new RNG("keyWorker-" + rand),
            publicClusters: new RNG("publicClusters-" + rand),
            selectOwnCluster: new RNG("selectOwnCluster-" + rand),
            selectPrivateCluster: new RNG("selectPrivateCluster-" + rand),
            selectPublicCluster: new RNG("selectPublicCluster-" + rand),
            selfAttestation: new RNG("selfAttestation-" + rand),
            shuffle: new RNG("shuffle-" + rand),
            shuffleGroup: new RNG("shuffleGroup-" + rand),
            symptomatic: new RNG("symptomatic-" + rand),
            testDelay: new RNG("testDelay-" + rand),
            testKeyWorker: new RNG("testKeyWorker-" + rand),
            testNotified: new RNG("testNotified-" + rand),
            testSymptomatic: new RNG("testSymptomatic-" + rand),
            vaccinated: new RNG("symptomatic-" + rand),
            visitForeignCluster: new RNG("visitForeignCluster-" + rand),
            visitPublicCluster: new RNG("visitPublicCluster-" + rand),
        };
    };
    Model.prototype.handleMessage = function (req) {
        this.cfg = eval("(" + req.definition + ")");
        this.method = req.method;
        this.rand = req.rand;
        if (this.handle) {
            clearTimeout(this.handle);
        }
        this.init();
        this.run();
    };
    Model.prototype.init = function () {
        console.log(">> Running " + getMethodID(this.method));
        var cfg = this.cfg;
        var immunityEnd = cfg.days + 1;
        var rng = this.createRNG();
        // Generate people with custom attributes.
        var people = [];
        var appInstalled = 0;
        if (this.method === METHOD_APPLE_GOOGLE) {
            appInstalled = cfg.appleGoogleInstalled;
        }
        else if (this.method === METHOD_SAFETYSCORE) {
            appInstalled = cfg.safetyScoreInstalled;
        }
        var installBase = 0;
        var personID = 0;
        for (var i_1 = 0; i_1 < cfg.population; i_1++) {
            var attrs = 0;
            if (rng.appInstalled.next() <= appInstalled) {
                attrs |= PERSON_APP_INSTALLED;
                installBase++;
            }
            if (rng.keyWorker.next() <= cfg.keyWorkers) {
                attrs |= PERSON_KEY_WORKER;
            }
            if (rng.symptomatic.next() <= cfg.symptomatic) {
                attrs |= PERSON_SYMPTOMATIC;
            }
            var person = new Person(attrs, personID++, this);
            if (rng.vaccinated.next() <= cfg.vaccinated) {
                person.immunityEndDay = immunityEnd;
                person.status |= STATUS_IMMUNE;
            }
            people.push(person);
        }
        this.people = people;
        this.rng = rng;
        // Generate households and allocate people to households.
        var households = [];
        var i = 0;
        var houseID = 0;
        while (i < cfg.population) {
            var members = [];
            var size = cfg.household.sample(rng.household);
            for (var j = 0; j < size; j++) {
                members.push(i++);
                if (i === cfg.population) {
                    break;
                }
            }
            for (var j = 0; j < members.length; j++) {
                var selfID = members[j];
                var self_1 = people[selfID];
                var contacts = [];
                for (var x = 0; x < members.length; x++) {
                    var otherID = members[x];
                    if (otherID === selfID) {
                        continue;
                    }
                    contacts.push(otherID);
                }
                self_1.household = houseID;
                self_1.householdContacts = contacts;
            }
            households.push(members);
            houseID++;
        }
        this.households = households;
        // Generate clusters and allocate a primary cluster for everyone.
        var clusters = [];
        var present = [];
        var privateClusters = [];
        var publicClusters = [];
        var clusterID = 0;
        var clusterPeople = people.slice(0);
        shuffle(clusterPeople, rng.shuffle);
        i = 0;
        while (i < cfg.population) {
            var members = [];
            var size = cfg.clusterSize.sample(rng.clusterSize);
            for (var j = 0; j < size; j++) {
                var person = clusterPeople[i++];
                members.push(person.id);
                person.clusters.push(clusterID);
                if (i === cfg.population) {
                    break;
                }
            }
            var attrs = 0;
            if (rng.publicClusters.next() <= cfg.publicClusters) {
                attrs |= CLUSTER_PUBLIC;
                publicClusters.push(clusterID);
            }
            else {
                privateClusters.push(clusterID);
            }
            var cluster = {
                attrs: attrs,
                members: members,
            };
            clusterID++;
            clusters.push(cluster);
            present.push([]);
        }
        this.clusters = clusters;
        this.present = present;
        this.privateClusters = privateClusters;
        this.publicClusters = publicClusters;
        // Assign additional clusters for some people.
        var totalClusters = clusters.length;
        for (i = 0; i < cfg.population; i++) {
            var person = people[i];
            var size = cfg.clusterCount.sample(rng.clusterCount);
            if (size > 1) {
                for (var j = 1; j < size && j < totalClusters; j++) {
                    var id = Math.floor(rng.additionalCluster.next() * clusters.length);
                    while (includes(person.clusters, id)) {
                        id = Math.floor(rng.additionalCluster.next() * clusters.length);
                    }
                    clusters[id].members.push(person.id);
                    person.clusters.push(id);
                }
            }
        }
        // Make certain clusters safeguarded and install SafetyScore to all members.
        if (this.method === METHOD_SAFETYSCORE) {
            var converted = 0;
            var convert = new Set();
            var limit = Math.round(cfg.safeguardedClusters * cfg.population);
            var safeguarded = clusters.slice(0);
            shuffle(safeguarded, rng.shuffle);
            for (i = 0; i < safeguarded.length; i++) {
                if (converted >= limit) {
                    break;
                }
                var cluster = safeguarded[i];
                cluster.attrs |= CLUSTER_SAFEGUARDED;
                for (var j = 0; j < cluster.members.length; j++) {
                    var id = cluster.members[j];
                    var member = people[id];
                    if (!convert.has(id)) {
                        converted++;
                        convert.add(id);
                        if (rng.installOwn.next() <= cfg.installOwn &&
                            member.installSafetyScore(0)) {
                            installBase++;
                        }
                    }
                }
            }
            if (cfg.installHousehold) {
                for (i = 0; i < cfg.population; i++) {
                    var person = people[i];
                    if (!person.appInstalled()) {
                        continue;
                    }
                    for (var j = 0; j < person.householdContacts.length; j++) {
                        var id = person.householdContacts[j];
                        if (id > i) {
                            if (people[id].installSafetyScore(0)) {
                                installBase++;
                            }
                        }
                    }
                }
            }
        }
        else if (this.method === METHOD_APPLE_GOOGLE && cfg.installHousehold) {
            for (i = 0; i < cfg.population; i++) {
                var person = people[i];
                if (!person.appInstalled()) {
                    continue;
                }
                for (var j = 0; j < person.householdContacts.length; j++) {
                    var id = person.householdContacts[j];
                    if (id > i) {
                        var other = people[id];
                        if (!other.appInstalled()) {
                            other.attrs |= PERSON_APP_INSTALLED;
                            installBase++;
                        }
                    }
                }
            }
        }
        this.installBase = installBase / cfg.population;
        // Derive computed values from config parameters.
        var traceDays = 0;
        if (this.method === METHOD_APPLE_GOOGLE) {
            traceDays = 14;
        }
        else if (this.method === METHOD_SAFETYSCORE) {
            traceDays =
                cfg.preInfectiousDays +
                    cfg.preSymptomaticInfectiousDays +
                    Math.round(getMean(cfg.illness)) +
                    1;
        }
        this.computed = {
            dailyForeign: cfg.foreignImports / cfg.population,
            dailyTests: Math.round(cfg.dailyTestCapacity * cfg.population),
            inactivityPenalty: 100 / traceDays,
            infectiousDays: cfg.preSymptomaticInfectiousDays + Math.round(getMean(cfg.illness)),
            installForeign: cfg.installForeign / cfg.days,
            traceDays: traceDays,
        };
        // Initialise other properties.
        this.day = 0;
        this.isolatedPeriods = 0;
        this.lockdown = false;
        this.lockdownEase = 0;
        this.period = 0;
        this.recentInfections = [];
        this.results = [];
        this.spread = [];
        this.testQueue = [];
    };
    Model.prototype.nextDay = function () {
        this.day++;
        var cfg = this.cfg;
        var computed = this.computed;
        var day = this.day;
        var infectionRisk = cfg.infectionRisk;
        var isolationEnd = day + cfg.isolationDays;
        var people = this.people;
        var rng = this.rng;
        var infected = 0;
        var spreadBy = 0;
        var spreadTotal = 0;
        for (var i = 0; i < cfg.population; i++) {
            var person = people[i];
            // Update the status of infected people.
            if (person.infected()) {
                infected++;
                if (day === person.infectedDay + cfg.preInfectiousDays) {
                    // Handle the day the person might become symptomatic.
                    person.status |= STATUS_CONTAGIOUS;
                    if (person.symptomatic()) {
                        if (rng.isolationSymptomatic.next() <= cfg.isolationSymptomatic) {
                            person.isolate(isolationEnd);
                        }
                        if (person.testDay === 0 &&
                            rng.testSymptomatic.next() <= cfg.testSymptomatic) {
                            person.testDay = day + cfg.testDelay.sample(rng.testDelay);
                        }
                        if (this.method === METHOD_SAFETYSCORE &&
                            person.appInstalled() &&
                            rng.selfAttestation.next() <= cfg.selfAttestation) {
                            person.deposit(-1, 0, people, 3);
                        }
                        if (cfg.isolateHousehold) {
                            for (var j = 0; j < person.householdContacts.length; j++) {
                                people[person.householdContacts[j]].isolate(isolationEnd);
                            }
                        }
                    }
                }
                else if (day === person.infectionEndDay) {
                    spreadBy++;
                    spreadTotal += person.spread;
                    // Handle the end of the infection.
                    if (rng.fatality.next() <= cfg.fatalityRisk) {
                        person.status = STATUS_DEAD;
                    }
                    else {
                        person.status &= ~STATUS_CONTAGIOUS;
                        person.status &= ~STATUS_INFECTED;
                        person.status |= STATUS_IMMUNE | STATUS_RECOVERED;
                    }
                }
                // If the person is contagious, try and infect any healthy members of
                // their household.
                if ((person.status & STATUS_CONTAGIOUS) !== 0) {
                    for (var j = 0; j < person.householdContacts.length; j++) {
                        var other = people[person.householdContacts[j]];
                        if ((other.status & STATUS_INFECTED) === 0 &&
                            (other.status & STATUS_IMMUNE) === 0) {
                            if (rng.infect.next() <= infectionRisk) {
                                other.infect(day, person.gen + 1);
                                person.spread++;
                                break;
                            }
                        }
                    }
                }
            }
            else if (rng.foreign.next() <= computed.dailyForeign) {
                // Infect a person from a foreign imported case.
                person.infect(day, 0);
            }
            if (person.status === STATUS_DEAD) {
                continue;
            }
            // If the person wants to be tested, then add them to the test queue.
            if (day === person.testDay) {
                person.testDay = -1;
                this.testQueue.push(person.id);
            }
            // Strip the individual of immunity once it ends.
            if ((person.status & STATUS_IMMUNE) !== 0 &&
                day === person.immunityEndDay) {
                person.status &= ~STATUS_IMMUNE;
            }
            // Remove the individual from isolation once it ends.
            if ((person.status & STATUS_ISOLATED) !== 0 &&
                day === person.isolationEndDay) {
                person.isolationEndDay = 0;
                person.status &= ~STATUS_ISOLATED;
            }
            // If the individual was prompted to consider the app, see if they'll
            // install it.
            if ((person.attrs & PERSON_APP_FOREIGN_CLUSTER) !== 0) {
                if (rng.installForeign.next() <= computed.installForeign) {
                    person.attrs &= ~PERSON_APP_FOREIGN_CLUSTER;
                    person.installSafetyScore(day);
                }
            }
        }
        if (this.recentInfections.length === computed.infectiousDays) {
            var first = this.recentInfections.shift();
            first[0] = spreadTotal;
            first[1] = spreadBy;
            this.recentInfections.push(first);
        }
        else {
            this.recentInfections.push([spreadTotal, spreadBy]);
        }
        var queue = this.testQueue;
        if (this.method === METHOD_APPLE_GOOGLE) {
            // Follow the Apple/Google Exposure Notification method where contacts of
            // infected individuals are notified.
            var seen = new Set();
            for (var i = 0; i < computed.dailyTests && queue.length > 0; i++) {
                var id = queue.shift();
                var person = people[id];
                if (person.status === STATUS_DEAD) {
                    continue;
                }
                if (person.infected()) {
                    // Place infected individuals into isolation.
                    person.isolate(isolationEnd);
                    if (cfg.isolateHousehold) {
                        for (var j = 0; j < person.householdContacts.length; j++) {
                            people[person.householdContacts[j]].isolate(isolationEnd);
                        }
                    }
                    // Notify their contacts.
                    if (person.appInstalled()) {
                        for (var j = 0; j < person.contacts.length; j++) {
                            var contacts = person.contacts[j];
                            for (var k = 0; k < contacts.length; k++) {
                                var id_1 = contacts[k];
                                if (seen.has(id_1)) {
                                    continue;
                                }
                                var contact = people[id_1];
                                // Prompt the contact to get tested.
                                if (contact.testDay === 0 &&
                                    rng.testNotified.next() <= cfg.testNotified) {
                                    contact.testDay = day + cfg.testDelay.sample(rng.testDelay);
                                }
                                // Prompt the contact to self-isolate.
                                if (rng.isolationLikelihood.next() <= cfg.isolationLikelihood) {
                                    contact.isolate(isolationEnd);
                                }
                                seen.add(id_1);
                            }
                        }
                    }
                }
                else if ((person.status & STATUS_ISOLATED) !== 0) {
                    // If an individual had been notified and isolated, remove them from
                    // isolation.
                    person.isolationEndDay = 0;
                    person.status &= ~STATUS_ISOLATED;
                }
                person.testDay = 0;
            }
            // Remove old contacts and re-use cleared Array for upcoming contacts.
            for (var i = 0; i < cfg.population; i++) {
                var person = people[i];
                if (person.status !== STATUS_DEAD && person.appInstalled()) {
                    if (person.contacts.length === computed.traceDays) {
                        var first = person.contacts.shift();
                        first.length = 0;
                        person.contacts.push(first);
                    }
                    else {
                        person.contacts.push([]);
                    }
                }
            }
        }
        else if (this.method === METHOD_SAFETYSCORE) {
            var inactivityPenalty = computed.inactivityPenalty, traceDays = computed.traceDays;
            // Handle test results.
            for (var i = 0; i < computed.dailyTests && queue.length > 0; i++) {
                var id = queue.shift();
                var person = people[id];
                if (person.status === STATUS_DEAD) {
                    continue;
                }
                if (person.infected()) {
                    person.isolate(isolationEnd);
                    if (cfg.isolateHousehold) {
                        for (var j = 0; j < person.householdContacts.length; j++) {
                            people[person.householdContacts[j]].isolate(isolationEnd);
                        }
                    }
                    if (person.appInstalled()) {
                        person.deposit(-1, 0, people, 0);
                    }
                }
                else {
                    person.tokens.length = 0;
                    person.tokens.push([0, 0, 0, 0, 0, 0]);
                    if ((person.status & STATUS_ISOLATED) !== 0) {
                        person.isolationEndDay = 0;
                        person.status &= ~STATUS_ISOLATED;
                    }
                }
                person.testDay = 0;
            }
            // Amplify second-degree weighting based on app penetration and test
            // capacity.
            var contactLikelihood = this.installBase * this.installBase;
            var secondDegree = cfg.secondDegreeWeight *
                Math.min(10 / (contactLikelihood * contactLikelihood * cfg.dailyTestCapacity), 50);
            for (var i = 0; i < cfg.population; i++) {
                var person = people[i];
                if (person.status === STATUS_DEAD || !person.appInstalled()) {
                    continue;
                }
                // Update the SafetyScore of everyone who has the app installed.
                var score = 100;
                var selfAttestations = 0;
                for (var j = 0; j < person.tokens.length; j++) {
                    var account = person.tokens[j];
                    score -= account[0] * 100;
                    score -= account[1] * 50;
                    score -= account[2] * secondDegree;
                    selfAttestations += account[3] * 100;
                    selfAttestations += account[4] * 50;
                    selfAttestations += account[5] * secondDegree;
                }
                // Only consider self-attestations if there are deposits that were
                // triggered by an official test.
                if (score < 100) {
                    score -= selfAttestations;
                }
                var active = Math.max(0, day - person.installDate);
                if (active < traceDays) {
                    score -= (traceDays - active) * inactivityPenalty;
                }
                person.score = score;
                var recentFirst = false;
                if (person.tokens.length > 0) {
                    recentFirst = person.tokens[person.tokens.length - 1][1] > 0;
                }
                // Prompt the individual to isolate and get tested if they received a
                // recent first-degree deposit triggered by an official test.
                if (recentFirst && score <= cfg.isolationThreshold) {
                    if (rng.isolationLikelihood.next() <= cfg.isolationLikelihood) {
                        person.isolate(isolationEnd);
                    }
                    if (person.testDay === 0 &&
                        rng.testNotified.next() <= cfg.testNotified) {
                        person.testDay = day + cfg.testDelay.sample(rng.testDelay);
                    }
                }
                // Remove old contacts.
                if (person.contacts.length === computed.traceDays) {
                    var first = person.contacts.shift();
                    first.length = 0;
                    person.contacts.push(first);
                }
                else {
                    person.contacts.push([]);
                }
                // Remove old daily accounts.
                if (person.tokens.length === computed.traceDays) {
                    var first = person.tokens.shift();
                    first[0] = 0;
                    first[1] = 0;
                    first[2] = 0;
                    first[3] = 0;
                    first[4] = 0;
                    first[5] = 0;
                    person.tokens.push(first);
                }
                else {
                    person.tokens.push([0, 0, 0, 0, 0, 0]);
                }
            }
        }
        else {
            for (var i = 0; i < computed.dailyTests && queue.length > 0; i++) {
                var id = queue.shift();
                var person = people[id];
                if (person.status === STATUS_DEAD) {
                    continue;
                }
                if (person.infected()) {
                    person.isolate(isolationEnd);
                    if (cfg.isolateHousehold) {
                        for (var j = 0; j < person.householdContacts.length; j++) {
                            people[person.householdContacts[j]].isolate(isolationEnd);
                        }
                    }
                }
            }
            if (this.method === METHOD_LOCKDOWN) {
                if (this.lockdown) {
                    if (infected < cfg.lockdownEnd) {
                        this.lockdownEase++;
                        if (this.lockdownEase === cfg.lockdownEndWindow) {
                            this.lockdown = false;
                        }
                    }
                    else {
                        this.lockdownEase = 0;
                    }
                }
                else if (infected >= cfg.lockdownStart) {
                    this.lockdown = true;
                }
            }
            if (this.lockdown && cfg.testKeyWorkers) {
                // Test key workers.
                for (var i = 0; i < cfg.population; i++) {
                    var person = people[i];
                    if ((person.attrs & PERSON_KEY_WORKER) !== 0 &&
                        person.testDay === 0 &&
                        rng.testKeyWorker.next() <= cfg.testKeyWorker) {
                        person.testDay = day + cfg.testDelay.sample(rng.testDelay);
                    }
                }
            }
        }
        // Generate the daily stats.
        var lockdown = this.lockdown;
        var stats = {
            dead: 0,
            healthy: 0,
            immune: 0,
            infected: 0,
            installed: 0,
            isolated: 0,
            isolatedPeriods: this.isolatedPeriods / CLUSTER_PERIODS,
            lockdown: lockdown,
            r: 0,
            recovered: 0,
            uhealthy: 0,
        };
        for (var i = 0; i < cfg.population; i++) {
            var person = people[i];
            var status_1 = person.status;
            if ((status_1 & STATUS_HEALTHY) !== 0) {
                stats.healthy++;
            }
            else if ((status_1 & STATUS_INFECTED) !== 0) {
                stats.infected++;
            }
            else if ((status_1 & STATUS_RECOVERED) !== 0) {
                stats.recovered++;
            }
            else if ((status_1 & STATUS_DEAD) !== 0) {
                stats.dead++;
            }
            if ((status_1 & STATUS_IMMUNE) !== 0) {
                stats.immune++;
            }
            if (lockdown) {
                if ((person.attrs & PERSON_KEY_WORKER) === 0) {
                    stats.isolated++;
                }
                else if ((status_1 & STATUS_ISOLATED) !== 0) {
                    stats.isolated++;
                }
            }
            else {
                if ((status_1 & STATUS_ISOLATED) !== 0) {
                    stats.isolated++;
                }
            }
            if ((person.attrs & PERSON_APP_INSTALLED) !== 0) {
                stats.installed++;
                if ((status_1 & STATUS_HEALTHY) !== 0) {
                    stats.uhealthy++;
                }
            }
        }
        spreadTotal = 0;
        spreadBy = 0;
        for (var i = 0; i < this.recentInfections.length; i++) {
            var stat = this.recentInfections[i];
            spreadTotal += stat[0];
            spreadBy += stat[1];
        }
        if (spreadBy) {
            stats.r = spreadTotal / spreadBy;
        }
        this.installBase = stats.installed / cfg.population;
        this.isolatedPeriods = 0;
        this.results.push(stats);
        return stats;
    };
    Model.prototype.nextPeriod = function () {
        this.period++;
        if (this.period === CLUSTER_PERIODS) {
            this.period = 0;
        }
        var cfg = this.cfg;
        var clusters = this.clusters;
        var lockdown = this.lockdown;
        var method = this.method;
        var people = this.people;
        var rng = this.rng;
        var present = this.present;
        var isolatedPeriods = 0;
        for (var i = 0; i < cfg.population; i++) {
            var person = people[i];
            // Skip dead people.
            if (person.status === STATUS_DEAD) {
                continue;
            }
            if (lockdown) {
                // If they're not a key worker, see if they might temporarily break
                // isolation for some reason.
                if ((person.attrs & PERSON_KEY_WORKER) === 0) {
                    if (rng.isolationLockdown.next() <= cfg.isolationLockdown) {
                        isolatedPeriods++;
                        continue;
                    }
                }
                else if ((person.status & STATUS_ISOLATED) !== 0) {
                    if (rng.isolationLockdown.next() <= cfg.isolationEffectiveness) {
                        isolatedPeriods++;
                        continue;
                    }
                }
            }
            else {
                // If the person is self-isolating, only consider them if they temporarily
                // break isolation for some reason.
                if ((person.status & STATUS_ISOLATED) !== 0) {
                    if (rng.isolationEffectiveness.next() <= cfg.isolationEffectiveness) {
                        isolatedPeriods++;
                        continue;
                    }
                }
            }
            // Select a cluster for the person to visit.
            var clusterID = void 0;
            if (rng.visitForeignCluster.next() <= cfg.visitForeignCluster) {
                if (rng.visitPublicCluster.next() <= cfg.visitPublicCluster) {
                    clusterID = Math.floor(rng.selectPublicCluster.next() * this.publicClusters.length);
                }
                else {
                    clusterID = Math.floor(rng.selectPrivateCluster.next() * this.privateClusters.length);
                }
            }
            else {
                clusterID = Math.floor(rng.selectOwnCluster.next() * person.clusters.length);
            }
            if (method === METHOD_SAFETYSCORE) {
                var cluster = clusters[clusterID];
                if ((cluster.attrs & CLUSTER_SAFEGUARDED) === 0) {
                    // If the person has SafetyScore and the cluster isn't safeguarded,
                    // see if they'll consider visiting it. We don't consider this an
                    // isolated period as it's a free choice by the individual.
                    if ((person.attrs & PERSON_APP_INSTALLED) !== 0) {
                        if (!(rng.exposedVisit.next() <= cfg.exposedVisit)) {
                            continue;
                        }
                    }
                }
                else {
                    // For a safeguarded cluster, if the user doesn't have the app
                    // installed, see if they will consider installing it.
                    if ((person.attrs & PERSON_APP_INSTALLED) === 0) {
                        person.attrs |= PERSON_APP_FOREIGN_CLUSTER;
                        continue;
                    }
                    // If they do have the app, check if their score meets the necessary
                    // level.
                    if (person.score <= cfg.safeguardThreshold) {
                        continue;
                    }
                }
            }
            present[clusterID].push(person.id);
        }
        var contagious = [];
        var day = this.day;
        var group = [];
        var healthy = [];
        var infectionRisk = cfg.infectionRisk;
        var installed = [];
        var trace = this.method === METHOD_APPLE_GOOGLE || this.method === METHOD_SAFETYSCORE;
        for (var i = 0; i < present.length; i++) {
            var visitors = present[i];
            while (visitors.length > 0) {
                // Segment the visitors into groups.
                var size = cfg.groupSize.sample(rng.groupSize);
                contagious.length = 0;
                group.length = 0;
                healthy.length = 0;
                installed.length = 0;
                while (size > 0 && visitors.length > 0) {
                    group.push(visitors.pop());
                    size--;
                }
                shuffle(group, rng.shuffleGroup);
                // Identify the healthy/recovered, the infected, and those with apps.
                for (var j = 0; j < group.length; j++) {
                    var person = people[group[j]];
                    if ((person.status & STATUS_CONTAGIOUS) !== 0) {
                        contagious.push(person);
                    }
                    else if ((person.status & STATUS_INFECTED) === 0 &&
                        (person.status & STATUS_IMMUNE) === 0) {
                        healthy.push(person);
                    }
                    if (trace && (person.attrs & PERSON_APP_INSTALLED) !== 0) {
                        installed.push(person);
                    }
                }
                // If any are contagious, try and infect the healthy.
                if (contagious.length > 0 && healthy.length > 0) {
                    for (var j = 0; j < healthy.length; j++) {
                        for (var k = 0; k < contagious.length; k++) {
                            if (rng.infect.next() <= infectionRisk) {
                                var from = contagious[k];
                                healthy[j].infect(day, from.gen + 1);
                                from.spread++;
                                break;
                            }
                        }
                    }
                }
                // Establish contacts between those who have app installed.
                if (trace) {
                    for (var j = 0; j < installed.length; j++) {
                        var contacts = installed[j].contacts;
                        var cur = contacts[contacts.length - 1];
                        for (var k = 0; k < installed.length; k++) {
                            if (j === k) {
                                continue;
                            }
                            cur.push(installed[k].id);
                        }
                    }
                }
            }
        }
        this.isolatedPeriods += isolatedPeriods;
    };
    Model.prototype.run = function () {
        for (var i = 0; i < this.cfg.days; i++) {
            if (this.period === 0) {
                var stats = this.nextDay();
                sendMessage({ rand: this.rand, stats: stats });
            }
            for (var j = 0; j < CLUSTER_PERIODS; j++) {
                this.nextPeriod();
            }
        }
    };
    return Model;
}());
var NormalDistribution = /** @class */ (function () {
    function NormalDistribution(_a) {
        var mean = _a.mean, min = _a.min;
        this.max = 2 * mean;
        this.min = min || 0;
    }
    NormalDistribution.prototype.rand = function (rng) {
        var u1 = 0;
        var u2 = 0;
        while (u1 === 0) {
            u1 = rng.next();
        }
        while (u2 === 0) {
            u2 = rng.next();
        }
        var sample = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        sample = Math.round((sample / 10 + 0.5) * this.max);
        return sample;
    };
    NormalDistribution.prototype.sample = function (rng) {
        while (true) {
            var val = this.rand(rng);
            if (val >= this.min && val <= this.max) {
                return val;
            }
        }
    };
    return NormalDistribution;
}());
// Person encapsulates an individual within the simulation.
var Person = /** @class */ (function () {
    function Person(attrs, id, model) {
        this.attrs = attrs;
        this.clusters = [];
        this.contacts = [];
        this.gen = -1;
        this.id = id;
        this.infectedDay = 0;
        this.infectionEndDay = 0;
        this.immunityEndDay = 0;
        this.installDate = 0;
        this.isolationEndDay = 0;
        this.model = model;
        this.score = 0;
        this.spread = 0;
        this.status = STATUS_HEALTHY;
        this.testDay = 0;
        this.tokens = [];
    }
    Person.prototype.appInstalled = function () {
        return (this.attrs & PERSON_APP_INSTALLED) !== 0;
    };
    // NOTE(tav): We simplify the calculations and deposit the tokens in just the
    // current daily account.
    Person.prototype.deposit = function (from, depth, people, offset) {
        if (this.status === STATUS_DEAD) {
            return;
        }
        this.tokens[this.tokens.length - 1][offset + depth] += 1;
        if (depth === 2) {
            return;
        }
        depth++;
        for (var i = 0; i < this.contacts.length; i++) {
            var contacts = this.contacts[i];
            for (var j = 0; j < contacts.length; j++) {
                var id = contacts[j];
                if (id === from) {
                    continue;
                }
                people[id].deposit(this.id, depth, people, offset);
            }
        }
    };
    Person.prototype.infect = function (today, gen) {
        if ((this.status & STATUS_INFECTED) !== 0) {
            return false;
        }
        if ((this.status & STATUS_IMMUNE) !== 0) {
            return false;
        }
        if (this.status === STATUS_DEAD) {
            return false;
        }
        var model = this.model;
        this.gen = gen;
        this.infectedDay = model.day;
        this.infectionEndDay =
            model.day +
                model.cfg.preInfectiousDays +
                model.cfg.preSymptomaticInfectiousDays +
                model.cfg.illness.sample(model.rng.illness);
        this.immunityEndDay =
            this.infectionEndDay + model.cfg.immunity.sample(model.rng.immunity);
        this.spread = 0;
        this.status &= ~STATUS_HEALTHY;
        this.status &= ~STATUS_RECOVERED;
        this.status |= STATUS_INFECTED;
        return true;
    };
    Person.prototype.infected = function () {
        return (this.status & STATUS_INFECTED) !== 0;
    };
    Person.prototype.installSafetyScore = function (day) {
        if (this.appInstalled()) {
            return false;
        }
        this.attrs |= PERSON_APP_INSTALLED;
        this.installDate = day;
        this.tokens.push([0, 0, 0, 0, 0, 0]);
        return true;
    };
    Person.prototype.isolate = function (end) {
        if (this.status === STATUS_DEAD) {
            return;
        }
        this.isolationEndDay = end;
        this.status |= STATUS_ISOLATED;
    };
    Person.prototype.symptomatic = function () {
        return (this.attrs & PERSON_SYMPTOMATIC) !== 0;
    };
    return Person;
}());
// Derived from:
// https://stackoverflow.com/questions/1241555/algorithm-to-generate-poisson-and-binomial-random-numbers
var PoissonDistribution = /** @class */ (function () {
    function PoissonDistribution(_a) {
        var max = _a.max, mean = _a.mean, min = _a.min;
        this.limit = Math.exp(-mean);
        this.max = max;
        this.min = min;
    }
    PoissonDistribution.prototype.rand = function (rng) {
        var k = 1;
        var p = rng.next();
        while (p > this.limit) {
            k++;
            p *= rng.next();
        }
        return k - 1;
    };
    PoissonDistribution.prototype.sample = function (rng) {
        while (true) {
            var val = this.rand(rng);
            if (val >= this.min && val <= this.max) {
                return val;
            }
        }
    };
    return PoissonDistribution;
}());
// RNG provides a seedable random number generator.
//
// Copyright (c) 2010, Johannes Baagøe <baagoe@baagoe.org>
// MIT License
//
// https://web.archive.org/web/20120124013936/http://baagoe.org/en/wiki/Better_random_numbers_for_javascript
var RNG = /** @class */ (function () {
    function RNG(seed) {
        var n = 0xefc8249d;
        var mash = function (data) {
            for (var i = 0; i < data.length; i++) {
                n += data.charCodeAt(i);
                var h_1 = 0.02519603282416938 * n;
                n = h_1 >>> 0;
                h_1 -= n;
                h_1 *= n;
                n = h_1 >>> 0;
                h_1 -= n;
                n += h_1 * 0x100000000; // 2^32
            }
            return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
        };
        this.c = 1;
        this.s0 = mash(" ");
        this.s1 = mash(" ");
        this.s2 = mash(" ");
        this.s0 -= mash(seed);
        if (this.s0 < 0) {
            this.s0 += 1;
        }
        this.s1 -= mash(seed);
        if (this.s1 < 0) {
            this.s1 += 1;
        }
        this.s2 -= mash(seed);
        if (this.s2 < 0) {
            this.s2 += 1;
        }
    }
    RNG.prototype.next = function () {
        var t = 2091639 * this.s0 + this.c * 2.3283064365386963e-10; // 2^-32
        this.s0 = this.s1;
        this.s1 = this.s2;
        return (this.s2 = t - (this.c = t | 0));
    };
    return RNG;
}());
var Simulation = /** @class */ (function () {
    function Simulation(ctrl, method) {
        this.ctrl = ctrl;
        this.dirty = true;
        this.downloadHidden = true;
        this.heading = getMethodLabel(method);
        this.height = 300;
        this.hidden = false;
        this.method = method;
        this.results = [];
        this.runs = [];
        this.runsFinished = false;
        this.runsUpdate = false;
        this.selected = -1;
        this.summaries = [];
        this.summariesShown = false;
        this.variance = 0;
        this.width = 0;
    }
    Simulation.prototype.computeBoxPlots = function () {
        var dead = [];
        var healthy = [];
        var infected = [];
        var isolated = [];
        for (var i = 0; i < this.summaries.length; i++) {
            var summary = this.summaries[i];
            dead.push(summary.dead);
            healthy.push(summary.healthy);
            infected.push(summary.infected);
            isolated.push(summary.isolated);
        }
        return {
            dead: computeBoxPlot(dead),
            healthy: computeBoxPlot(healthy),
            infected: computeBoxPlot(infected),
            isolated: computeBoxPlot(isolated),
        };
    };
    Simulation.prototype.computeVariance = function () {
        var runs = this.summaries.length;
        var values = [];
        var sum = 0;
        for (var i = 0; i < runs; i++) {
            var val = this.summaries[i].healthy;
            values.push(val);
            sum += val;
        }
        var mean = sum / runs;
        sum = 0;
        for (var i = 0; i < runs; i++) {
            var diff = values[i] - mean;
            sum += diff * diff;
        }
        return sum / runs;
    };
    Simulation.prototype.downloadCSV = function (idx) {
        var lines = [];
        var results = this.runs[idx];
        lines.push("Day,Healthy,Infected,Recovered,Immune,Dead,Isolated,App Installed");
        for (var i = 0; i < results.length; i++) {
            var stats = results[i];
            lines.push(i + 1 + "," + stats.healthy + "," + stats.infected + "," + stats.recovered + "," + stats.immune + "," + stats.dead + "," + stats.isolated + "," + stats.installed);
        }
        var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
        var filename = this.getFilename("csv");
        triggerDownload(blob, filename);
    };
    Simulation.prototype.downloadGraph = function (format, selected) {
        var _this = this;
        var filename = this.getFilename(format);
        var graph = document.createElementNS(SVG, "svg");
        graph.setAttribute("height", "100%");
        graph.setAttribute("preserveAspectRatio", "none");
        graph.setAttribute("viewBox", "0 0 " + this.cfg.days + " " + this.cfg.population);
        graph.setAttribute("width", "100%");
        var results = this.results;
        if (typeof selected !== "undefined") {
            results = this.runs[selected];
        }
        else if (this.selected !== -1) {
            results = this.runs[this.selected];
        }
        this.generateGraph(graph, results);
        var svg = new XMLSerializer().serializeToString(graph);
        var blob = new Blob([svg], { type: "image/svg+xml" });
        if (format === "svg") {
            triggerDownload(blob, filename);
            return;
        }
        var legend = 300;
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        var height = 1500;
        var summary = getSummary(results);
        var width = 2400;
        var img = new Image(width, height);
        var url = URL.createObjectURL(blob);
        canvas.height = height + legend;
        canvas.width = width;
        img.onload = function () {
            URL.revokeObjectURL(url);
            var bottomline = height + 210;
            var fifth = width / 5;
            var font = "60px bold " + _this.cfg.imageFont;
            var midline = height + 75;
            var topline = height + 130;
            var textpad = 120;
            var posX = 70;
            // Draw blank area at bottom of the canvas for the legend.
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, width, height + legend);
            // Draw the graph.
            ctx.drawImage(img, 0, 0, width, height);
            // Draw the legend for healthy.
            ctx.fillStyle = COLOUR_HEALTHY;
            ctx.fillRect(posX, midline, 100, 100);
            ctx.fillStyle = "#000";
            ctx.font = font;
            ctx.fillText("Healthy", posX + textpad, topline);
            ctx.fillText("" + percent(summary.healthy), posX + textpad, bottomline);
            // Draw the legend for infected.
            posX += fifth;
            ctx.fillStyle = COLOUR_INFECTED;
            ctx.fillRect(posX, midline, 100, 100);
            ctx.fillStyle = "#000";
            ctx.font = font;
            ctx.fillText("Infected", posX + textpad, topline);
            ctx.fillText("" + percent(summary.infected), posX + textpad, bottomline);
            // Draw the legend for recovered.
            posX += fifth;
            ctx.fillStyle = COLOUR_RECOVERED;
            ctx.fillRect(posX, midline, 100, 100);
            ctx.fillStyle = "#000";
            ctx.font = font;
            ctx.fillText("Recovered", posX + textpad, topline);
            // Draw the legend for dead.
            posX += fifth;
            ctx.fillStyle = COLOUR_DEAD;
            ctx.fillRect(posX, midline, 100, 100);
            ctx.fillStyle = "#000";
            ctx.font = font;
            ctx.fillText("Dead", posX + textpad, topline);
            ctx.fillText("" + percent(summary.dead), posX + textpad, bottomline);
            // Draw the legend for isolated.
            posX += fifth;
            ctx.fillStyle = "#eeeeee";
            ctx.fillRect(posX, midline, 100, 100);
            ctx.fillStyle = "#000";
            ctx.font = font;
            ctx.fillText("Isolated", posX + textpad, topline);
            ctx.fillText("" + percent(summary.isolated), posX + textpad, bottomline);
            canvas.toBlob(function (blob) {
                if (blob) {
                    triggerDownload(blob, filename);
                }
            });
        };
        img.src = url;
    };
    Simulation.prototype.generateGraph = function ($graph, results) {
        var height = this.cfg.population;
        var width = this.cfg.days;
        addNode($graph, "rect", {
            fill: "#eeeeee",
            height: height,
            width: width,
            x: 0,
            y: 0,
        });
        var days = results.length;
        if (days === 0) {
            return;
        }
        var healthy = [];
        var infected = [];
        var recovered = [];
        for (var i = 0; i < days; i++) {
            var stats = results[i];
            var posX_1 = i;
            var posY_1 = stats.dead;
            recovered.push(posX_1 + "," + posY_1);
            posY_1 += stats.recovered;
            healthy.push(posX_1 + "," + posY_1);
            posY_1 += stats.healthy;
            infected.push(posX_1 + "," + posY_1);
        }
        var last = results[days - 1];
        var posX = days;
        var posY = last.dead;
        recovered.push(posX + "," + posY);
        recovered.push(days + "," + height);
        recovered.push("0," + height);
        posY += last.recovered;
        healthy.push(posX + "," + posY);
        healthy.push(days + "," + height);
        healthy.push("0," + height);
        posY += last.healthy;
        infected.push(posX + "," + posY);
        infected.push(days + "," + height);
        infected.push("0," + height);
        addNode($graph, "rect", {
            fill: COLOUR_DEAD,
            height: height,
            width: days,
            x: 0,
            y: 0,
        });
        addNode($graph, "polyline", {
            fill: COLOUR_RECOVERED,
            points: recovered.join(" "),
        });
        addNode($graph, "polyline", {
            fill: COLOUR_HEALTHY,
            points: healthy.join(" "),
        });
        addNode($graph, "polyline", {
            fill: COLOUR_INFECTED,
            points: infected.join(" "),
        });
    };
    Simulation.prototype.getFilename = function (ext) {
        return "simulation-" + getMethodID(this.method) + "-" + Date.now() + "." + ext;
    };
    Simulation.prototype.getResults = function () {
        if (this.selected === -1) {
            return this.results;
        }
        return this.runs[this.selected];
    };
    Simulation.prototype.handleMessage = function (resp) {
        if (this.rand !== resp.rand) {
            return;
        }
        this.markDirty();
        this.results.push(resp.stats);
        if (this.results.length === this.cfg.days) {
            var summary = getSummary(this.results, this.summaries.length, this.rand);
            this.runs.push(this.results);
            this.runsUpdate = true;
            this.summaries.push(summary);
            this.summaries.sort(function (a, b) { return b.healthy - a.healthy; });
            this.ctrl.updateComparison(this.method, this.computeBoxPlots());
            var runs = this.summaries.length;
            if (runs === this.cfg.runsMax) {
                this.runsFinished = true;
            }
            else if (runs >= this.cfg.runsMin) {
                var variance = this.computeVariance();
                if (this.variance !== 0) {
                    var diff = Math.abs(variance - this.variance) / 100;
                    if (diff < this.cfg.runsVariance) {
                        this.runsFinished = true;
                    }
                }
                this.variance = variance;
            }
            else {
                this.variance = this.computeVariance();
            }
            if (this.runsFinished) {
                if (this.selected === -1) {
                    this.selected = this.summaries[Math.floor(this.summaries.length / 2)].idx;
                }
                this.worker.terminate();
                this.worker = undefined;
            }
            else {
                this.rand++;
                this.results = [];
                this.worker.postMessage({
                    definition: this.definition,
                    method: this.method,
                    rand: this.rand,
                });
            }
        }
    };
    Simulation.prototype.hide = function () {
        if (this.hidden) {
            return;
        }
        if (this.worker) {
            this.worker.terminate();
            this.worker = undefined;
        }
        this.downloadHidden = true;
        this.hidden = true;
        this.$heading.style.paddingTop = "11px";
        hide(this.$content);
        hide(this.$download);
        hide(this.$run);
        hide(this.$settings);
        var $visibilityImage = h("img", { src: "show.svg", alt: "Show" });
        this.$visibilityImage.replaceWith($visibilityImage);
        this.$visibilityImage = $visibilityImage;
        var $visibilitySpan = h("span", null, "Show/Restart Simulation");
        this.$visibilitySpan.replaceWith($visibilitySpan);
        this.$visibilitySpan = $visibilitySpan;
        this.$root.addEventListener("click", this.handleToggle);
        this.$root.classList.toggle("clickable");
        this.ctrl.setDimensions();
    };
    Simulation.prototype.hideInfo = function () {
        if (this.handle) {
            clearTimeout(this.handle);
            this.handle = undefined;
        }
        hide(this.$info);
    };
    Simulation.prototype.hideSummaries = function () {
        if (!this.summariesShown) {
            return;
        }
        this.runsUpdate = true;
        this.summariesShown = false;
        this.$summariesLink.innerHTML = "Show All";
        hide(this.$summaries);
        this.markDirty();
    };
    Simulation.prototype.markDirty = function () {
        this.dirty = true;
        this.ctrl.requestRedraw();
    };
    Simulation.prototype.randomise = function () {
        var rand = Date.now();
        console.log("Using random seed: " + rand);
        this.ctrl.updateComparison(this.method);
        this.run(this.cfg, this.definition, rand);
    };
    Simulation.prototype.render = function () {
        if (!IN_BROWSER) {
            return;
        }
        if (this.hidden || overlayShown || !this.dirty) {
            return;
        }
        var results = this.getResults();
        this.dirty = false;
        this.renderSummary(results);
        this.renderGraph(results);
        this.renderRuns();
    };
    Simulation.prototype.renderGraph = function (results) {
        if (!IN_BROWSER) {
            return;
        }
        if (results.length === this.cfg.days && this.downloadHidden) {
            this.downloadHidden = false;
            show(this.$download);
        }
        var $graph = this.$graph;
        $graph.innerHTML = "";
        this.generateGraph($graph, results);
    };
    Simulation.prototype.renderInfo = function (e) {
        var _this = this;
        var bounds = this.$graph.getBoundingClientRect();
        var pos = e.clientX - bounds.left;
        if (pos < 0 || pos > this.width) {
            if (this.handle) {
                this.hideInfo();
            }
            return;
        }
        var results = this.getResults();
        var width = this.width / this.cfg.days;
        var day = Math.floor(pos / width);
        if (day >= results.length) {
            if (this.handle) {
                this.hideInfo();
            }
            return;
        }
        if (this.handle) {
            clearTimeout(this.handle);
        }
        var stats = results[day];
        var $users = h("div", null);
        if (this.method === METHOD_APPLE_GOOGLE ||
            this.method === METHOD_SAFETYSCORE) {
            $users = (h("div", null,
                "App Users",
                h("div", { class: "right value" }, stats.installed)));
        }
        var $info = (h("div", { class: "info" },
            h("div", null,
                "Day",
                h("div", { class: "right" }, day + 1)),
            h("div", null,
                "Dead",
                h("div", { class: "right value-dead" }, stats.dead)),
            h("div", null,
                "Recovered",
                h("div", { class: "right value-recovered" }, stats.recovered)),
            h("div", null,
                "Healthy",
                h("div", { class: "right value-healthy" }, stats.healthy)),
            h("div", null,
                "Infected",
                h("div", { class: "right value-infected" }, stats.infected)),
            h("div", null,
                "Isolated",
                h("div", { class: "right value" }, stats.isolated)),
            $users));
        this.$info.replaceWith($info);
        this.$info = $info;
        show(this.$info);
        this.handle = setTimeout(function () { return _this.hideInfo(); }, 1200);
    };
    Simulation.prototype.renderRuns = function () {
        var _this = this;
        if (!this.runsUpdate) {
            return;
        }
        this.runsUpdate = false;
        var runs = this.runs.length;
        var linkedStatus = false;
        var status = "";
        if (!this.runsFinished) {
            if (!(this.cfg.runsMin === 1 && this.cfg.runsMax === 1)) {
                status = "Running #" + (this.runs.length + 1);
                if (this.summariesShown && this.selected !== -1) {
                    linkedStatus = true;
                }
            }
        }
        if (linkedStatus) {
            this.$status.innerHTML = "";
            this.$status.appendChild(h("a", { href: "", onclick: function (e) {
                    e.preventDefault();
                    if (_this.selected !== -1) {
                        _this.selected = -1;
                    }
                    _this.hideSummaries();
                } }, status));
        }
        else {
            this.$status.innerHTML = status;
        }
        if (runs === 0) {
            if (!this.summariesShown) {
                hide(this.$summariesLink);
            }
        }
        else {
            show(this.$summariesLink);
        }
        var $tbody = h("tbody", null);
        var _loop_1 = function (i) {
            var summary = this_1.summaries[i];
            var idx = summary.idx;
            var view = void 0;
            if (this_1.selected === idx) {
                view = h("td", null,
                    "View #",
                    idx + 1);
            }
            else {
                view = (h("td", null,
                    h("a", { href: "#" + summary.rand, title: "Run " + (idx + 1) + " of " + this_1.runs.length, onclick: function (e) {
                            e.preventDefault();
                            _this.selected = idx;
                            _this.runsUpdate = true;
                            _this.markDirty();
                        } },
                        "View #",
                        idx + 1)));
            }
            $tbody.appendChild(h("tr", null,
                view,
                h("td", { class: "value-healthy" },
                    decimal(summary.healthy),
                    "%"),
                h("td", { class: "value-infected" },
                    decimal(summary.infected),
                    "%"),
                h("td", { class: "value-dead" },
                    decimal(summary.dead),
                    "%"),
                h("td", null,
                    decimal(summary.isolated),
                    "%"),
                h("td", { class: "downloads" },
                    h("a", { href: "", onclick: function (e) {
                            e.preventDefault();
                            _this.downloadCSV(idx);
                        } }, "csv"),
                    " ",
                    "\u00B7",
                    " ",
                    h("a", { href: "", onclick: function (e) {
                            e.preventDefault();
                            _this.downloadGraph("png", idx);
                        } }, "png"),
                    " ",
                    "\u00B7",
                    " ",
                    h("a", { href: "", onclick: function (e) {
                            e.preventDefault();
                            _this.downloadGraph("svg", idx);
                        } }, "svg"))));
        };
        var this_1 = this;
        for (var i = 0; i < this.summaries.length; i++) {
            _loop_1(i);
        }
        this.$tbody.replaceWith($tbody);
        this.$tbody = $tbody;
    };
    Simulation.prototype.renderSummary = function (results) {
        if (!IN_BROWSER) {
            return;
        }
        if (results.length === 0) {
            return;
        }
        var summary = getSummary(results);
        var $summary = (h("div", { class: "summary" },
            h("div", null,
                "Days",
                h("div", { class: "right" }, summary.days)),
            h("div", null,
                "Isolated",
                h("div", { class: "right value" }, percent(summary.isolated))),
            h("div", null,
                "Healthy",
                h("div", { class: "right value-healthy" }, percent(summary.healthy))),
            h("div", null,
                "Infected",
                h("div", { class: "right value-infected" }, percent(summary.infected))),
            h("div", null,
                "Dead",
                h("div", { class: "right value-dead" }, percent(summary.dead)))));
        this.$summary.replaceWith($summary);
        this.$summary = $summary;
    };
    Simulation.prototype.run = function (cfg, definition, rand) {
        var _this = this;
        if (this.worker) {
            this.worker.terminate();
        }
        if (IN_BROWSER) {
            this.$graph.setAttribute("viewBox", "0 0 " + cfg.days + " " + cfg.population);
            this.$summary.innerHTML = "&nbsp;";
        }
        if (this.hidden) {
            this.hidden = false;
            show(this.$root);
        }
        this.cfg = cfg;
        this.definition = definition;
        this.downloadHidden = true;
        this.rand = rand;
        this.results = [];
        this.runs = [];
        this.runsFinished = false;
        this.runsUpdate = true;
        this.selected = -1;
        this.summaries = [];
        this.variance = 0;
        this.worker = new AbstractedWorker("./simulation.js");
        this.worker.onMessage(function (msg) { return _this.handleMessage(msg); });
        this.worker.postMessage({ definition: definition, method: this.method, rand: rand });
        this.markDirty();
        hide(this.$download);
    };
    Simulation.prototype.setDimensions = function () {
        if (!IN_BROWSER) {
            return;
        }
        if (this.hidden) {
            return;
        }
        var width = this.$root.offsetWidth - this.$summary.offsetWidth;
        if (width < 200) {
            width = 200;
        }
        if (width === this.width) {
            return;
        }
        this.$graph.setAttribute("height", "" + this.height);
        this.$graph.setAttribute("width", "" + width);
        this.runsUpdate = true;
        this.width = width;
        this.markDirty();
    };
    Simulation.prototype.setupUI = function () {
        var _this = this;
        this.handleToggle = function (e) { return _this.toggle(e); };
        var $download = (h("div", { class: "action" },
            h("img", { src: "download.svg", alt: "Download" }),
            h("span", null, "Download PNG")));
        $download.addEventListener("click", function () { return _this.downloadGraph("png"); });
        hide($download);
        var $graph = document.createElementNS(SVG, "svg");
        $graph.addEventListener("mousemove", function (e) { return _this.renderInfo(e); });
        $graph.addEventListener("mouseout", function () { return _this.hideInfo(); });
        $graph.setAttribute("preserveAspectRatio", "none");
        $graph.setAttribute("viewBox", "0 0 0 0");
        var $heading = h("div", { class: "heading" }, this.heading);
        var $info = h("div", { class: "info" });
        var $run = (h("div", { class: "action" },
            h("img", { class: "refresh", src: "refresh.svg", alt: "Refresh" }),
            h("span", null, "Run New Simulation")));
        $run.addEventListener("click", function (e) { return _this.randomise(); });
        var $settings = (h("div", { class: "action" },
            h("img", { src: "settings.svg", alt: "Settings" }),
            h("span", null, "Edit Config")));
        $settings.addEventListener("click", displayConfig);
        var $summariesLink = h("a", { href: "" }, "See All");
        $summariesLink.addEventListener("click", function (e) {
            return _this.toggleSummaries(e);
        });
        hide($summariesLink);
        var $status = h("div", { class: "status" });
        var $statusHolder = (h("div", { class: "status-holder" },
            $status,
            h("div", { class: "right value" }, $summariesLink)));
        var $summary = h("div", { class: "summary" });
        var $tbody = h("tbody", null);
        var $summaries = (h("div", { class: "summaries" },
            h("table", null,
                h("thead", null,
                    h("tr", null,
                        h("th", null, "Run"),
                        h("th", null,
                            "Healthy",
                            h("img", { class: "down", src: "down.svg", alt: "Down Arrow" })),
                        h("th", null, "Infected"),
                        h("th", null, "Dead"),
                        h("th", null, "Isolated"),
                        h("th", null, "Download"))),
                $tbody)));
        hide($summaries);
        var $visibilityImage = h("img", { src: "hide.svg", alt: "Hide" });
        var $visibilitySpan = h("span", null, "Hide/Stop Simulation");
        var $visibility = (h("div", { class: "action" },
            $visibilityImage,
            $visibilitySpan));
        $visibility.addEventListener("click", this.handleToggle);
        var $content = (h("div", { class: "content" },
            h("div", { class: "graph-holder" },
                $info,
                $summary,
                h("div", { class: "graph" }, $graph),
                $statusHolder),
            h("div", { class: "clear" }),
            $summaries));
        var $root = (h("div", { class: "simulation" },
            $heading,
            $visibility,
            $settings,
            $run,
            $download,
            h("div", { class: "clear" }),
            $content));
        this.$content = $content;
        this.$download = $download;
        this.$graph = $graph;
        this.$heading = $heading;
        this.$info = $info;
        this.$root = $root;
        this.$run = $run;
        this.$settings = $settings;
        this.$status = $status;
        this.$summaries = $summaries;
        this.$summary = $summary;
        this.$summariesLink = $summariesLink;
        this.$tbody = $tbody;
        this.$visibilityImage = $visibilityImage;
        this.$visibilitySpan = $visibilitySpan;
        return $root;
    };
    Simulation.prototype.show = function () {
        if (!this.hidden) {
            return;
        }
        this.hidden = false;
        this.$heading.style.paddingTop = "14px";
        show(this.$content);
        show(this.$run);
        show(this.$settings);
        var $visibilityImage = h("img", { src: "hide.svg", alt: "Hide" });
        this.$visibilityImage.replaceWith($visibilityImage);
        this.$visibilityImage = $visibilityImage;
        var $visibilitySpan = h("span", null, "Hide/Stop Simulation");
        this.$visibilitySpan.replaceWith($visibilitySpan);
        this.$visibilitySpan = $visibilitySpan;
        this.$root.removeEventListener("click", this.handleToggle);
        this.$root.classList.toggle("clickable");
        var ctrl = this.ctrl;
        ctrl.setDimensions();
        this.run(ctrl.cfg, ctrl.definition, ctrl.rand);
    };
    Simulation.prototype.showSummaries = function () {
        this.runsUpdate = true;
        this.summariesShown = true;
        this.$summariesLink.innerHTML = "Hide All";
        show(this.$summaries);
        this.markDirty();
    };
    Simulation.prototype.toggle = function (e) {
        if (e) {
            e.stopPropagation();
        }
        if (this.hidden) {
            this.show();
        }
        else {
            this.hide();
        }
    };
    Simulation.prototype.toggleSummaries = function (e) {
        if (e) {
            e.preventDefault();
        }
        if (this.summariesShown) {
            this.hideSummaries();
        }
        else {
            this.showSummaries();
        }
    };
    return Simulation;
}());
// Derived from https://github.com/willscott/zipfian
var ZipfDistribution = /** @class */ (function () {
    function ZipfDistribution(_a) {
        var max = _a.max, min = _a.min;
        this.items = max - min + 1;
        this.max = max;
        this.min = min;
        this.zetan = getZeta(this.items, 0.99);
        this.eta =
            (1 - Math.pow(2 / this.items, 0.01)) / (1 - getZeta(2, 0.99) / this.zetan);
    }
    ZipfDistribution.prototype.sample = function (rng) {
        var u = rng.next();
        var uz = u * this.zetan;
        if (uz < 1) {
            return this.min;
        }
        return (this.min +
            Math.floor(this.items * Math.pow(this.eta * u - this.eta + 1, 100)));
    };
    return ZipfDistribution;
}());
function $(id) {
    return document.getElementById(id);
}
function addNode(dst, typ, attrs) {
    var node = document.createElementNS(SVG, typ);
    if (attrs) {
        var keys = Object.keys(attrs);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            node.setAttribute(key, attrs[key]);
        }
    }
    dst.appendChild(node);
    return node;
}
// Derived from https://github.com/datavisyn/chartjs-chart-box-and-violin-plot
function computeBoxPlot(values) {
    values.sort(function (a, b) { return a - b; });
    var q1 = quantile(values, 0.25);
    var q3 = quantile(values, 0.75);
    var iqr = q3 - q1;
    var max = values[values.length - 1];
    max = Math.min(max, q3 + 1.5 * iqr);
    var min = values[0];
    min = Math.max(min, q1 - 1.5 * iqr);
    for (var i = 0; i < values.length; i++) {
        var v = values[i];
        if (v >= min) {
            min = v;
            break;
        }
    }
    if (min > q1) {
        min = q1;
    }
    for (var i = values.length - 1; i >= 0; i--) {
        var v = values[i];
        if (v <= max) {
            max = v;
            break;
        }
    }
    if (max < q3) {
        max = q3;
    }
    return {
        max: max,
        median: quantile(values, 0.5),
        min: min,
        q1: q1,
        q3: q3,
        size: values.length,
    };
}
function decimal(v) {
    if (Math.floor(v) === v) {
        return v;
    }
    return v.toFixed(2);
}
function defaultConfig() {
    return {
        // the portion of people who have an Apple/Google-style Contact Tracing app installed
        appleGoogleInstalled: 2 / 3,
        // distribution of the number of clusters for a person
        clusterCount: new ZipfDistribution({ min: 1, max: 20 }),
        // distribution of the number of "primary" members in a cluster
        clusterSize: new PoissonDistribution({ mean: 20, min: 1, max: 50 }),
        // the portion of the population that can be tested
        dailyTestCapacity: 0.005,
        // number of days to run the simulation
        days: 400,
        // the likelihood of a SafetyScore user being okay with visiting a non-safeguarded cluster
        exposedVisit: 1 / 5,
        // likelihood of dying once infected
        fatalityRisk: 0.01,
        // daily likelihood of someone in the whole population getting infected from outside the population
        foreignImports: 0.06,
        // distribution of the group size within a cluster for a single period
        groupSize: new PoissonDistribution({ mean: 2.5, min: 2, max: 20 }),
        // distribution of the number of people in a household [not used yet]
        household: new PoissonDistribution({ mean: 2.1, min: 1, max: 6 }),
        // distribution of illness days after incubation
        illness: new NormalDistribution({ mean: 10.5, min: 7 }),
        // font to use on labels in generated images
        imageFont: "HelveticaNeue-Light, Arial",
        // distribution of the days of natural immunity
        immunity: new NormalDistribution({ mean: 238, min: 0 }),
        // likelihood of someone getting infected during a single contact
        infectionRisk: 0.01,
        // likelihood of someone installing SafetyScore for visiting a foreign safeguarded cluster
        installForeign: 0,
        // likelihood of someone installing SafetyScore if one of their own clusters becomes safeguarded
        installOwn: 1,
        // whether the app is installed for the whole household during initial installations
        installHousehold: false,
        // isolate whole household if someone self-isolates
        isolateHousehold: true,
        // number of days a person should self-isolate
        isolationDays: 21,
        // likelihood of a self-isolating person staying at home for any given period during the day
        isolationEffectiveness: 0.9,
        // likelihood of a notified person self-isolating
        isolationLikelihood: 0.9,
        // likelihood of an isolated person staying at home for any given period during lockdown
        isolationLockdown: 0.9,
        // the SafetyScore level below which one is notified to self-isolate and test
        isolationThreshold: 50,
        // likelihood of a symptomatic individual self-isolating
        isolationSymptomatic: 0.9,
        // portion of the population who will not be isolated during lockdown
        keyWorkers: 0.16,
        // the number of infected people, below which a lockdown could end
        lockdownEnd: 5,
        // number of days the number of infected people must be below "lockdownEnd" before lockdown ends
        lockdownEndWindow: 14,
        // the number of infected people which will trigger a lockdown
        lockdownStart: 7,
        // total number of people
        population: 10000,
        // number of days before becoming infectious
        preInfectiousDays: 3,
        // number of days of being infectious before possibly becoming symptomatic
        preSymptomaticInfectiousDays: 3,
        // portion of clusters which are public
        publicClusters: 0.15,
        // maximum number of runs to execute
        runsMax: 50,
        // minimum number of runs to execute
        runsMin: 5,
        // threshold of variance change at which to stop runs
        runsVariance: 0.005,
        // the SafetyScore level needed to access a safeguarded cluster
        safeguardThreshold: 50,
        // the portion of clusters who safeguard access via SafetyScore
        safeguardedClusters: 2 / 3,
        // the portion of people who have SafetyScore installed at the start
        safetyScoreInstalled: 0,
        // a multiplicative weighting factor for second-degree tokens
        secondDegreeWeight: 1,
        // likelihood of a symptomatic person self-attesting
        selfAttestation: 0,
        // the portion of people who become symptomatic
        symptomatic: 1 / 3,
        // the distribution of the delay days between symptomatic/notified and testing
        testDelay: new PoissonDistribution({ mean: 2, min: 1, max: 10 }),
        // test all key workers
        testKeyWorkers: false,
        // likelihood of a key worker getting tested
        testKeyWorker: 1,
        // likelihood of a person getting themselves tested if notified
        testNotified: 0.9,
        // likelihood of a person getting themselves tested if symptomatic
        testSymptomatic: 0.6,
        // portion of people who have long-lasting immunity from vaccination
        vaccinated: 0,
        // likelihood of visiting a "foreign" cluster during a period
        visitForeignCluster: 0.2,
        // likelihood of visiting a public cluster when visiting a foreign cluster
        visitPublicCluster: 0.15,
    };
}
function defaultConfigDefinition() {
    var cfg = defaultConfig.toString();
    var start = cfg.indexOf("{", cfg.indexOf("{") + 1);
    var end = cfg.indexOf("};");
    cfg = cfg
        .slice(start, end)
        .trim()
        .split(",\n        //")
        .join(",\n\n    //")
        .split("        ")
        .join("    ");
    return cfg + "\n}";
}
function displayConfig() {
    if (overlayShown || !ctrl) {
        return;
    }
    overlayShown = true;
    ctrl.pause();
    if (!$config) {
        $config = $("config");
        $mirror = $("mirror");
    }
    $config.value = ctrl.definition;
    updateMirror(ctrl.definition);
    $("inlay").style.display = "flex";
    show($("overlay"));
    $config.focus();
    $config.scrollTop = 0;
    $config.setSelectionRange(0, 0);
}
function downloadImage(img) {
    if (img.format === "svg") {
        var blob = new Blob([img.svg], { type: "image/svg+xml" });
        triggerDownload(blob, img.filename);
    }
    else {
        downloadPNG(img.svg, img.filename, img.height, img.width);
    }
}
function downloadPNG(svg, filename, height, width) {
    var blob = new Blob([svg], { type: "image/svg+xml" });
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");
    var img = new Image(width, height);
    var url = URL.createObjectURL(blob);
    canvas.height = height;
    canvas.width = width;
    img.onload = function () {
        URL.revokeObjectURL(url);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(function (blob) {
            if (blob) {
                triggerDownload(blob, filename);
            }
        });
    };
    img.src = url;
}
function genSVG(colors) {
    var out = ["<svg>"];
    out.push("</svg>");
    console.log(out.join(""));
}
function getCmdBool(flag) {
    return process.argv.indexOf(flag) !== -1;
}
function getCmdOpt(flag, fallback) {
    var idx = process.argv.indexOf(flag);
    if (idx === -1) {
        return fallback;
    }
    return process.argv[idx + 1];
}
function getMean(dist) {
    var rng = new RNG("mean");
    var val = 0;
    for (var i = 0; i < 10000; i++) {
        val += dist.sample(rng);
    }
    return val / 10000;
}
function getMethod(s) {
    var method;
    switch (s) {
        case "apple-google":
            method = METHOD_APPLE_GOOGLE;
            break;
        case "lockdown":
            method = METHOD_LOCKDOWN;
            break;
        case "free-movement":
            method = METHOD_FREE_MOVEMENT;
            break;
        case "safetyscore":
            method = METHOD_SAFETYSCORE;
            break;
        default:
            throw "Unknown method: " + s;
    }
    return method;
}
function getMethodID(method) {
    if (method === METHOD_APPLE_GOOGLE) {
        return "apple-google";
    }
    if (method === METHOD_FREE_MOVEMENT) {
        return "free-movement";
    }
    if (method === METHOD_LOCKDOWN) {
        return "lockdown";
    }
    if (method === METHOD_SAFETYSCORE) {
        return "safetyscore";
    }
    throw "Unknown method: " + method;
}
function getMethodLabel(method) {
    if (method === METHOD_APPLE_GOOGLE) {
        return "Apple/Google-Style Contact Tracing";
    }
    if (method === METHOD_FREE_MOVEMENT) {
        return "Free Movement";
    }
    if (method === METHOD_LOCKDOWN) {
        return "Lockdowns";
    }
    if (method === METHOD_SAFETYSCORE) {
        return "SafetyScore";
    }
    throw "Unknown method: " + method;
}
function getSummary(results, idx, rand) {
    var days = results.length;
    var last = results[results.length - 1];
    var total = last.healthy + last.dead + last.recovered + last.infected;
    var healthy = (last.healthy / total) * 100;
    var infected = 100 - healthy;
    var dead = (last.dead / total) * 100;
    var isolated = 0;
    for (var i = 0; i < results.length; i++) {
        isolated += results[i].isolated;
    }
    isolated = (isolated / (days * total)) * 100;
    return {
        days: days,
        dead: dead,
        healthy: healthy,
        idx: idx || 0,
        infected: infected,
        isolated: isolated,
        population: total,
        rand: rand || 0,
    };
}
function getZeta(n, theta) {
    var sum = 0;
    for (var i = 0; i < n; i++) {
        sum += 1 / Math.pow(i + 1, theta);
    }
    return sum;
}
function greyscale(colour) {
    var grey = parseInt(colour.slice(1, 3), 16);
    grey += parseInt(colour.slice(3, 5), 16);
    grey += parseInt(colour.slice(5, 7), 16);
    grey = Math.ceil(grey / 3);
    var hex = grey.toString(16);
    return "#" + hex + hex + hex;
}
function h(tag, props) {
    var children = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        children[_i - 2] = arguments[_i];
    }
    var elem = document.createElement(tag);
    if (props) {
        var keys = Object.keys(props);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var val = props[key];
            if (key === "class") {
                elem.className = val;
            }
            else if (key === "onclick") {
                elem.addEventListener("click", val);
            }
            else {
                elem.setAttribute(key, val);
            }
        }
    }
    for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (typeof child === "string" || typeof child === "number") {
            elem.appendChild(document.createTextNode(child));
        }
        else {
            elem.appendChild(child);
        }
    }
    return elem;
}
function handleInlayClick(e) {
    e.stopPropagation();
}
function handleKeyboard(e) {
    var e_1, _a;
    if (overlayShown) {
        if (e.code === "Escape") {
            handleOverlayClick();
            return;
        }
        if (e.ctrlKey && e.code === "Enter") {
            updateConfig();
            return;
        }
        return;
    }
    if (e.code === "KeyE") {
        displayConfig();
        return;
    }
    if (e.code === "KeyR" && ctrl) {
        ctrl.randomise();
        return;
    }
    if (e.code === "KeyX" && ctrl) {
        try {
            for (var _b = __values(ctrl.simList), _c = _b.next(); !_c.done; _c = _b.next()) {
                var sim = _c.value;
                sim.toggleSummaries();
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return;
    }
}
function handleOverlayClick(e) {
    if (e) {
        e.stopPropagation();
    }
    if (!overlayShown) {
        return;
    }
    overlayShown = false;
    $("error").style.display = "none";
    $("overlay").style.display = "none";
    if (ctrl) {
        ctrl.resume();
    }
}
function handleResize() {
    if (ctrl) {
        ctrl.setDimensions();
    }
}
function hide(elem) {
    if (IN_BROWSER) {
        elem.style.display = "none";
    }
}
function includes(array, value) {
    for (var i = 0; i < array.length; i++) {
        if (array[i] === value) {
            return true;
        }
    }
    return false;
}
function killWorkers() {
    if (!ctrl) {
        return;
    }
    for (var i = 0; i < ctrl.simList.length; i++) {
        var sim = ctrl.simList[i];
        if (sim.worker) {
            sim.worker.terminate();
        }
    }
}
function percent(v) {
    if (v < 1 || v > 99) {
        v = parseFloat(v.toFixed(2));
        if (v == 0) {
            return "0";
        }
        return v + "%";
    }
    return Math.round(v) + "%";
}
function printDistribution(dist) {
    var e_2, _a;
    var bins = {};
    var rng = new RNG("dist");
    for (var i = 0; i < 100000; i++) {
        var val = dist.sample(rng);
        if (bins[val]) {
            bins[val] += 1;
        }
        else {
            bins[val] = 1;
        }
    }
    console.log("Value,Count");
    try {
        for (var _b = __values(Object.keys(bins)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var i = _c.value;
            console.log(i + "," + bins[i]);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_2) throw e_2.error; }
    }
}
function printUsage() {
    console.log("Usage: simulation [OPTIONS]\n\n  --config FILE    path to a config file\n");
}
// Derived from https://github.com/datavisyn/chartjs-chart-box-and-violin-plot
function quantile(values, q) {
    var idx = q * (values.length - 1) + 1;
    var lo = Math.floor(idx);
    var diff = idx - lo;
    var a = values[lo - 1];
    if (diff === 0) {
        return a;
    }
    return diff * (values[lo] - a) + a;
}
function scrollEditor() {
    $mirror.scrollTop = $config.scrollTop;
}
function sendMessage(resp) {
    if (IN_BROWSER) {
        postMessage(resp);
    }
    else if (parentPort) {
        parentPort.postMessage(resp);
    }
}
function show(elem) {
    if (IN_BROWSER) {
        elem.style.display = "block";
    }
}
// Adapted from
// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array, rng) {
    var _a;
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(rng.next() * (i + 1));
        _a = __read([array[j], array[i]], 2), array[i] = _a[0], array[j] = _a[1];
    }
}
function syncEditor() {
    if (!overlayShown) {
        return;
    }
    updateMirror($config.value);
}
function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.download = filename;
    link.href = url;
    link.click();
    setTimeout(function () { return URL.revokeObjectURL(url); }, 300000);
}
function trimpx(v) {
    if (!v.endsWith("px")) {
        throw new Error("CSS unit value \"" + v + "\" does not end in \"px\"");
    }
    return parseInt(v.slice(0, -2), 10);
}
function updateConfig(e) {
    if (e) {
        e.stopPropagation();
    }
    if (!overlayShown) {
        return;
    }
    var $config = $("config");
    var definition = $config.value;
    var cfg;
    try {
        cfg = validateConfig(eval("(" + definition + ")"));
    }
    catch (err) {
        var $error = $("error");
        $error.innerText = err.toString();
        $error.style.display = "block";
        return;
    }
    overlayShown = false;
    $("overlay").style.display = "none";
    ctrl.resume();
    ctrl.runNew(cfg, definition);
}
function updateMirror(src) {
    var code = Prism.highlight(src, Prism.languages.javascript);
    $mirror.innerHTML = code;
}
function validateConfig(cfg) {
    var v = new ConfigValidator(cfg);
    v.validateBoolean(["installHousehold", "isolateHousehold", "testKeyWorkers"]);
    v.validateDistribution([
        "clusterCount",
        "clusterSize",
        "groupSize",
        "household",
        "illness",
        "immunity",
        "testDelay",
    ]);
    v.validateNumber(0, [
        "lockdownEnd",
        "lockdownEndWindow",
        "preInfectiousDays",
        "preSymptomaticInfectiousDays",
    ]);
    v.validateNumber(1, [
        "days",
        "isolationDays",
        "lockdownStart",
        "population",
        "runsMax",
        "runsMin",
    ]);
    v.validatePercentage([
        "appleGoogleInstalled",
        "dailyTestCapacity",
        "exposedVisit",
        "fatalityRisk",
        "foreignImports",
        "infectionRisk",
        "installForeign",
        "installOwn",
        "isolationEffectiveness",
        "isolationLikelihood",
        "isolationLockdown",
        "isolationSymptomatic",
        "keyWorkers",
        "publicClusters",
        "runsVariance",
        "safeguardedClusters",
        "safetyScoreInstalled",
        "secondDegreeWeight",
        "selfAttestation",
        "symptomatic",
        "testKeyWorker",
        "testNotified",
        "testSymptomatic",
        "vaccinated",
        "visitForeignCluster",
        "visitPublicCluster",
    ]);
    v.validateScore(["isolationThreshold", "safeguardThreshold"]);
    v.validateString(["imageFont"]);
    v.checkFields();
    return cfg;
}
function runMulti(times, method) {
    var e_3, _a;
    var cfg = defaultConfig();
    var results = [];
    for (var i = 0; i < times; i++) {
        var model = new Model();
        var rand = Date.now();
        console.log(">> Running simulation #" + (i + 1));
        model.cfg = cfg;
        model.method = method;
        model.rand = rand;
        model.init();
        model.run();
        results.push({
            healthy: model.results[model.results.length - 1].healthy,
            rand: rand,
        });
    }
    results.sort(function (a, b) { return a.healthy - b.healthy; });
    try {
        for (var results_1 = __values(results), results_1_1 = results_1.next(); !results_1_1.done; results_1_1 = results_1.next()) {
            var result = results_1_1.value;
            console.log(result);
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (results_1_1 && !results_1_1.done && (_a = results_1.return)) _a.call(results_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
}
function main() {
    if (IN_BROWSER) {
        if (IN_WORKER) {
            var model_1 = new Model();
            self.onmessage = function (e) { return model_1.handleMessage(e.data); };
        }
        else {
            document.addEventListener("keyup", handleKeyboard);
            $("config").addEventListener("keyup", syncEditor);
            $("config").addEventListener("scroll", scrollEditor);
            $("inlay").addEventListener("click", handleInlayClick);
            $("overlay").addEventListener("click", handleOverlayClick);
            $("update-config").addEventListener("click", updateConfig);
            ctrl = new Controller();
            ctrl.initBrowser();
        }
    }
    else {
        var worker = require("worker_threads");
        var multi = getCmdOpt("--multi", "");
        if (multi) {
            if (process.argv.length === 2) {
                printUsage();
                process.exit();
            }
            var configFile = getCmdOpt("--config", "");
            if (configFile !== "") {
            }
            var method = getMethod(getCmdOpt("--method", "safetyscore"));
            runMulti(parseInt(multi, 10), method);
            return;
        }
        if (worker.isMainThread) {
            var method = getMethod(getCmdOpt("--method", "safetyscore"));
            ctrl = new Controller();
            ctrl.initNodeJS(method);
        }
        else {
            var model_2 = new Model();
            parentPort = worker.parentPort;
            parentPort.on("message", function (msg) { return model_2.handleMessage(msg); });
        }
    }
}
if (IN_BROWSER && !IN_WORKER) {
    window.addEventListener("beforeunload", killWorkers);
    window.addEventListener("load", main);
    window.addEventListener("resize", handleResize);
}
else {
    main();
}
