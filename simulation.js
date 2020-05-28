"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
// Determine host environment.
var IN_BROWSER = typeof window !== "undefined";
// Attribute values for clusters.
var CLUSTER_GATEKEPT = 1;
var CLUSTER_PUBLIC = 2;
// Attribute values for people.
var PERSON_APP_FOREIGN_CLUSTER = 1;
var PERSON_APP_INSTALLED = 2;
var PERSON_APP_OWN_CLUSTER = 4;
var PERSON_SYMPTOMATIC = 8;
// Constants relating to the visualisations.
var CLUSTER_HEIGHT = 24;
var CLUSTER_PADDING = 6;
var CLUSTER_WIDTH = 24;
var COLOUR_DEAD = "#444444";
var COLOUR_HEALTHY = "#8bb4b8";
var COLOUR_INFECTED = "#ff3945";
var COLOUR_RECOVERED = "#009d51";
var VIZ_COLOUR_DEAD = COLOUR_DEAD;
var VIZ_COLOUR_HEALTHY = COLOUR_HEALTHY;
var VIZ_COLOUR_INFECTED = COLOUR_INFECTED;
var VIZ_COLOUR_RECOVERED = COLOUR_RECOVERED;
// const COLOR_IMMUNE = "#b45cff"
// const VIZ_COLOUR_DEAD = "#dcdcdc"
// const VIZ_COLOUR_HEALTHY = "#b3e5ea"
// const VIZ_COLOUR_IMMUNE = "#00fc86"
// const VIZ_COLOUR_INFECTED = "#ffd1d2"
// Status values.
var STATUS_HEALTHY = 1;
var STATUS_INFECTED = 2;
var STATUS_CONTAGIOUS = 4;
var STATUS_RECOVERED = 8;
var STATUS_IMMUNE = 16;
var STATUS_DEAD = 32;
var STATUS_ISOLATED = 64;
// Trace methods.
var TRACE_NONE = 0;
var TRACE_APPLE_GOOGLE = 1;
var TRACE_SAFETYSCORE = 2;
// Time spent in different environments.
var CLUSTER_PERIODS = 8;
var HOUSEHOLD_PERIODS = 8;
var TOTAL_PERIODS = CLUSTER_PERIODS + HOUSEHOLD_PERIODS;
var configDisplayed = false;
var currentConfig;
var currentConfigDefinition;
var currentGraph;
var currentSim;
var currentViz;
var handle;
var randSuffix = 1590673685829;
var result = [];
var $config;
var $mirror;
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
    ConfigValidator.prototype.validateNumber = function (fields) {
        this.validate(fields, function (field, val) {
            if (typeof val !== "number") {
                throw "The value for \"" + field + "\" must be a number";
            }
            if (Math.floor(val) !== val) {
                throw "The value for \"" + field + "\" must be a whole number";
            }
            if (val < 1) {
                throw "The value for \"" + field + "\" must be greater than 1";
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
    return ConfigValidator;
}());
var Graph = /** @class */ (function () {
    function Graph(cfg) {
        var canvas = $("graph");
        var ctx = canvas.getContext("2d");
        ctx.globalCompositeOperation = "destination-over";
        ctx.imageSmoothingEnabled = false;
        var elems = [
            $("day"),
            $("dead"),
            $("recovered"),
            $("healthy"),
            $("infected"),
            $("isolated"),
        ];
        elems[1].style.color = COLOUR_DEAD;
        elems[2].style.color = COLOUR_RECOVERED;
        elems[3].style.color = COLOUR_HEALTHY;
        elems[4].style.color = COLOUR_INFECTED;
        this.$ = elems;
        this.canvas = canvas;
        this.cfg = cfg;
        this.ctx = ctx;
        this.values = [[1, 0, 0]];
        this.setDimensions();
    }
    Graph.prototype.draw = function (day) {
        var ctx = this.ctx;
        var cur = this.values[day];
        var height = this.height;
        var prevDay = day - 1;
        var prev = this.values[prevDay];
        var width = Math.max(1, Math.floor(this.width / this.cfg.days));
        var curX = width * day;
        var prevX = width * prevDay;
        // Draw the dead.
        ctx.fillStyle = COLOUR_DEAD;
        ctx.fillRect(prevX, 0, width, height);
        // Draw the recovered.
        ctx.fillStyle = COLOUR_RECOVERED;
        ctx.beginPath();
        ctx.moveTo(prevX, prev[2] * height);
        ctx.lineTo(curX, cur[2] * height);
        ctx.lineTo(curX, height);
        ctx.lineTo(prevX, height);
        ctx.fill();
        // Draw the healthy.
        ctx.fillStyle = COLOUR_HEALTHY;
        ctx.beginPath();
        ctx.moveTo(prevX, prev[1] * height);
        ctx.lineTo(curX, cur[1] * height);
        ctx.lineTo(curX, height);
        ctx.lineTo(prevX, height);
        ctx.fill();
        // Draw the infected.
        ctx.fillStyle = COLOUR_INFECTED;
        ctx.beginPath();
        ctx.moveTo(prevX, prev[0] * height);
        ctx.lineTo(curX, cur[0] * height);
        ctx.lineTo(curX, height);
        ctx.lineTo(prevX, height);
        ctx.fill();
    };
    Graph.prototype.redraw = function () {
        var days = this.values.length;
        if (days === 1) {
            return;
        }
        this.ctx.clearRect(0, 0, this.width, this.height);
        for (var i = 1; i < days; i++) {
            this.draw(i);
        }
    };
    Graph.prototype.setDimensions = function () {
        var canvas = this.canvas;
        var info = $("info");
        var style = getComputedStyle(info);
        var infoWidth = trimpx(style.width) + 2 * trimpx(style.paddingLeft);
        var height = info.scrollHeight;
        var width = document.body.clientWidth - infoWidth - 48;
        canvas.height = height;
        canvas.width = width;
        canvas.style.height = height + "px";
        canvas.style.width = width + "px";
        this.height = height;
        this.width = width;
        this.redraw();
    };
    Graph.prototype.update = function (stats) {
        var $ = this.$;
        var population = this.cfg.population;
        var values = [];
        var rem = 1 - stats.infected / population;
        values.push(rem);
        rem -= stats.healthy / population;
        values.push(rem);
        rem -= stats.recovered / population;
        values.push(rem);
        this.values.push(values);
        var day = this.values.length - 1;
        $[0].innerText = day.toString();
        $[1].innerText = stats.dead.toString();
        $[2].innerText = stats.recovered.toString();
        $[3].innerText = stats.healthy.toString();
        $[4].innerText = stats.infected.toString();
        $[5].innerText = stats.isolated.toString();
        this.draw(day);
    };
    return Graph;
}());
var NormalDistribution = /** @class */ (function () {
    function NormalDistribution(mean, min) {
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
var Person = /** @class */ (function () {
    function Person(attrs, id, sim) {
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
        this.score = 0;
        this.sim = sim;
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
    Person.prototype.deposit = function (from, depth, people) {
        if (this.status === STATUS_DEAD) {
            return;
        }
        this.tokens[this.tokens.length - 1][depth] += 1;
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
                people[id].deposit(this.id, depth, people);
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
        var sim = this.sim;
        this.gen = gen;
        this.infectedDay = sim.day;
        this.infectionEndDay =
            sim.day +
                sim.cfg.preInfectiousDays +
                sim.cfg.preSymptomaticInfectiousDays +
                sim.cfg.illness.sample(sim.rng);
        this.immunityEndDay =
            this.infectionEndDay + sim.cfg.immunity.sample(sim.rng);
        this.status &= ~STATUS_HEALTHY;
        this.status &= ~STATUS_RECOVERED;
        this.status |= STATUS_INFECTED;
        return true;
    };
    Person.prototype.infected = function () {
        return (this.status & STATUS_INFECTED) !== 0;
    };
    Person.prototype.installSafetyScore = function (day) {
        this.attrs |= PERSON_APP_INSTALLED;
        this.installDate = day;
        this.tokens.push([0, 0, 0]);
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
    function PoissonDistribution(mean, min, max) {
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
                var h = 0.02519603282416938 * n;
                n = h >>> 0;
                h -= n;
                h *= n;
                n = h >>> 0;
                h -= n;
                n += h * 0x100000000; // 2^32
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
    function Simulation(cfg) {
        this.cfg = cfg;
        this.recentInfections = [];
        this.testQueue = [];
    }
    Simulation.prototype.init = function () {
        var cfg = this.cfg;
        var rng = new RNG("init");
        // Generate people with custom attributes.
        var people = [];
        var installBase = 0;
        var personID = 0;
        for (var i_1 = 0; i_1 < cfg.population; i_1++) {
            var attrs = 0;
            if (rng.next() <= cfg.appInstalled) {
                attrs |= PERSON_APP_INSTALLED;
                installBase++;
            }
            if (rng.next() <= cfg.symptomatic) {
                attrs |= PERSON_SYMPTOMATIC;
            }
            var person = new Person(attrs, personID++, this);
            people.push(person);
        }
        this.installBase = installBase / cfg.population;
        this.people = people;
        // Generate households and allocate people to households.
        var households = [];
        var i = 0;
        var houseID = 0;
        while (i < cfg.population) {
            var members = [];
            var size = cfg.household.sample(rng);
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
            var house = {
                members: members,
                x: 0,
                y: 0,
            };
            households.push(house);
            houseID++;
        }
        this.households = households;
        // Generate clusters and allocate a primary cluster for everyone.
        var clusters = [];
        var presentNow = [];
        var presentPrev = [];
        var privateClusters = [];
        var publicClusters = [];
        var clusterID = 0;
        var clusterPeople = people.slice(0);
        shuffle(clusterPeople, rng);
        i = 0;
        while (i < cfg.population) {
            var members = [];
            var size = cfg.clusterSize.sample(rng);
            for (var j = 0; j < size; j++) {
                var person = clusterPeople[i++];
                members.push(person.id);
                person.clusters.push(clusterID);
                if (i === cfg.population) {
                    break;
                }
            }
            var attrs = 0;
            if (rng.next() <= cfg.gatekeptClusters) {
                attrs |= CLUSTER_GATEKEPT;
            }
            if (rng.next() <= cfg.publicClusters) {
                attrs |= CLUSTER_PUBLIC;
                publicClusters.push(clusterID);
            }
            else {
                privateClusters.push(clusterID);
            }
            var cluster = {
                attrs: attrs,
                members: members,
                x: 0,
                y: 0,
            };
            clusterID++;
            clusters.push(cluster);
            presentNow.push([]);
            presentPrev.push([]);
        }
        this.clusters = clusters;
        this.presentNow = presentNow;
        this.presentPrev = presentPrev;
        this.privateClusters = privateClusters;
        this.publicClusters = publicClusters;
        // Assign additional clusters for some people.
        var totalClusters = clusters.length;
        for (i = 0; i < cfg.population; i++) {
            var person = people[i];
            var size = cfg.clusterCount.sample(rng);
            if (size > 1) {
                for (var j = 1; j < size && j < totalClusters; j++) {
                    var cluster = Math.floor(rng.next() * clusters.length);
                    while (includes(person.clusters, cluster)) {
                        cluster = Math.floor(rng.next() * clusters.length);
                    }
                    person.clusters.push(cluster);
                }
            }
        }
        // Derive computed values from config parameters.
        var traceDays = 0;
        if (cfg.traceMethod === TRACE_APPLE_GOOGLE) {
            traceDays = 14;
        }
        else if (cfg.traceMethod === TRACE_SAFETYSCORE) {
            traceDays =
                cfg.preInfectiousDays +
                    cfg.preSymptomaticInfectiousDays +
                    Math.round(getMean(cfg.illness)) +
                    1;
        }
        var meanContacts = getMean(cfg.clusterCount) * getMean(cfg.clusterSize) +
            getMean(cfg.groupSize) *
                CLUSTER_PERIODS *
                traceDays *
                cfg.foreignClusterVisit;
        this.computed = {
            dailyForeign: cfg.foreignImports / cfg.days,
            dailyTests: Math.round(cfg.dailyTestCapacity * cfg.population),
            inactivityPenalty: 100 / traceDays,
            installForeign: cfg.installForeign / cfg.days,
            installOwn: cfg.installOwn / cfg.days,
            meanContacts: meanContacts,
            traceDays: traceDays,
        };
        // Create graph and visualisation.
        if (IN_BROWSER) {
            this.graph = new Graph(cfg);
            this.viz = new Visualisation(this);
            currentGraph = this.graph;
            currentViz = this.viz;
        }
        this.rng = new RNG("base-" + randSuffix);
        this.rngApp = new RNG("app-" + randSuffix);
        this.rngForeign = new RNG("foreign-" + randSuffix);
    };
    Simulation.prototype.next = function () {
        if (this.day === this.cfg.days) {
            if (IN_BROWSER) {
                $("download").style.display = "block";
            }
            return;
        }
        if (this.period === 0) {
            this.nextDay();
        }
        for (var i = 0; i < CLUSTER_PERIODS; i++) {
            this.nextPeriod();
        }
        this.queueNext();
    };
    Simulation.prototype.nextDay = function () {
        this.day++;
        var cfg = this.cfg;
        var computed = this.computed;
        var day = this.day;
        var isolationEnd = day + cfg.isolationDays;
        var people = this.people;
        var rng = this.rng;
        var rngApp = this.rngApp;
        var rngForeign = this.rngForeign;
        for (var i = 0; i < cfg.population; i++) {
            var person = people[i];
            // Update the status of infected people.
            if (person.infected()) {
                if (day === person.infectedDay + cfg.preInfectiousDays) {
                    // Handle the day the person might become symptomatic.
                    person.status |= STATUS_CONTAGIOUS;
                    if (person.symptomatic()) {
                        person.isolate(isolationEnd);
                        if (person.testDay === 0 && rng.next() <= cfg.testing) {
                            person.testDay = day + cfg.testDelay.sample(rng);
                        }
                    }
                }
                else if (day === person.infectionEndDay) {
                    // Handle the end of the infection.
                    if (rng.next() <= cfg.fatalityRisk) {
                        person.status = STATUS_DEAD;
                    }
                    else {
                        person.status &= ~STATUS_CONTAGIOUS;
                        person.status &= ~STATUS_INFECTED;
                        person.status |= STATUS_IMMUNE | STATUS_RECOVERED;
                    }
                }
            }
            else if (rngForeign.next() <= computed.dailyForeign) {
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
            if ((person.attrs & PERSON_APP_OWN_CLUSTER) !== 0) {
                if (rngApp.next() <= computed.installOwn) {
                    person.attrs &= ~PERSON_APP_OWN_CLUSTER;
                    person.installSafetyScore(day);
                }
            }
            else if ((person.attrs & PERSON_APP_FOREIGN_CLUSTER) !== 0) {
                if (rngApp.next() <= computed.installForeign) {
                    person.attrs &= ~PERSON_APP_FOREIGN_CLUSTER;
                    person.installSafetyScore(day);
                }
            }
        }
        var queue = this.testQueue;
        if (cfg.traceMethod === TRACE_APPLE_GOOGLE) {
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
                                if (contact.testDay === 0 && rngApp.next() <= cfg.testing) {
                                    contact.testDay = day + cfg.testDelay.sample(rng);
                                }
                                // Prompt the contact to self-isolate.
                                if (rngApp.next() <= cfg.selfIsolation) {
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
        else if (cfg.traceMethod === TRACE_SAFETYSCORE) {
            var inactivityPenalty = computed.inactivityPenalty, meanContacts = computed.meanContacts, traceDays = computed.traceDays;
            // Handle test results.
            for (var i = 0; i < computed.dailyTests && queue.length > 0; i++) {
                var id = queue.shift();
                var person = people[id];
                if (person.status === STATUS_DEAD) {
                    continue;
                }
                if (person.infected()) {
                    person.isolate(isolationEnd);
                    if (person.appInstalled()) {
                        person.deposit(-1, 0, people);
                    }
                }
                else if ((person.status & STATUS_ISOLATED) !== 0) {
                    person.isolationEndDay = 0;
                    person.status &= ~STATUS_ISOLATED;
                }
                person.testDay = 0;
            }
            // Amplify second-degree weighting based on app penetration and test
            // capacity.
            var contactLikelihood = this.installBase * this.installBase;
            var secondDegree = Math.min(10 / (contactLikelihood * contactLikelihood * cfg.dailyTestCapacity), 50);
            console.log(secondDegree);
            // const secondDegree = cfg.infectionRisk * (1.1 - this.installBase) * 10
            for (var i = 0; i < cfg.population; i++) {
                var person = people[i];
                if (person.status === STATUS_DEAD || !person.appInstalled()) {
                    continue;
                }
                // Update the SafetyScore of everyone who has the app installed.
                var score = 100;
                for (var j = 0; j < person.tokens.length; j++) {
                    var account = person.tokens[j];
                    score -= account[0] * 100;
                    score -= account[1] * 50;
                    score -= account[2] * secondDegree;
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
                // recent first-degree deposit
                if (recentFirst && score <= cfg.isolationThreshold) {
                    if (rngApp.next() <= cfg.selfIsolation) {
                        person.isolate(isolationEnd);
                    }
                    if (person.testDay === 0 && rngApp.next() <= cfg.testing) {
                        person.testDay = day + cfg.testDelay.sample(rng);
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
                    person.tokens.push(first);
                }
                else {
                    person.tokens.push([0, 0, 0]);
                }
            }
        }
        // Generate the daily stats.
        var stats = {
            dead: 0,
            healthy: 0,
            immune: 0,
            infected: 0,
            installed: 0,
            isolated: 0,
            recovered: 0,
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
            if ((status_1 & STATUS_ISOLATED) !== 0) {
                stats.isolated++;
            }
            if ((person.attrs & PERSON_APP_INSTALLED) !== 0) {
                stats.installed++;
            }
        }
        this.installBase = stats.installed / cfg.population;
        // Update output.
        if (IN_BROWSER) {
            this.viz.draw(people);
            this.graph.update(stats);
        }
        else {
            if (cfg.output === "console") {
                console.log(stats);
            }
            else {
                result.push(stats);
            }
        }
    };
    Simulation.prototype.nextPeriod = function () {
        this.period++;
        if (this.period === CLUSTER_PERIODS) {
            this.period = 0;
        }
        var cfg = this.cfg;
        var clusters = this.clusters;
        var traceMethod = cfg.traceMethod;
        var people = this.people;
        var rng = this.rng;
        var rngApp = this.rngApp;
        var present = this.presentNow;
        for (var i = 0; i < cfg.population; i++) {
            var person = people[i];
            // Skip dead people.
            if (person.status === STATUS_DEAD) {
                continue;
            }
            // If the person is self-isolating, only consider them if they temporarily
            // break isolation for some reason.
            if ((person.status & STATUS_ISOLATED) !== 0) {
                if (rng.next() <= cfg.isolation) {
                    continue;
                }
            }
            // Select a cluster for the person to visit.
            var clusterID = void 0;
            var foreign = true;
            if (rng.next() <= cfg.foreignClusterVisit) {
                if (rng.next() <= cfg.publicClusterVisit) {
                    clusterID = Math.floor(rng.next() * this.publicClusters.length);
                }
                else {
                    clusterID = Math.floor(rng.next() * this.privateClusters.length);
                }
            }
            else {
                clusterID = Math.floor(rng.next() * person.clusters.length);
                foreign = false;
            }
            if (traceMethod === TRACE_SAFETYSCORE) {
                var cluster = clusters[clusterID];
                if ((cluster.attrs & CLUSTER_GATEKEPT) === 0) {
                    // If the user has the app and the cluster isn't gate-kept, see if
                    // they'll consider visiting it.
                    if ((person.attrs & PERSON_APP_INSTALLED) !== 0) {
                        if (!(rngApp.next() <= cfg.exposedVisit)) {
                            continue;
                        }
                    }
                }
                else {
                    // For a gate-kept cluster, if the user doesn't have the app
                    // installed, see if they will consider installing it.
                    if ((person.attrs & PERSON_APP_INSTALLED) === 0) {
                        if (foreign) {
                            person.attrs |= PERSON_APP_FOREIGN_CLUSTER;
                        }
                        else {
                            person.attrs |= PERSON_APP_OWN_CLUSTER;
                        }
                        continue;
                    }
                    // If they do have the app, check if their score meets the necessary
                    // level.
                    if (person.score <= cfg.gatekeptThreshold) {
                        continue;
                    }
                }
            }
            present[clusterID].push(person.id);
        }
        var day = this.day;
        var group = [];
        var healthy = [];
        var infected = [];
        var infectionRisk = cfg.infectionRisk;
        var installed = [];
        var trace = cfg.traceMethod !== TRACE_NONE;
        for (var i = 0; i < present.length; i++) {
            var visitors = present[i];
            while (visitors.length > 0) {
                // Segment the visitors into groups.
                var size = cfg.groupSize.sample(rng);
                group.length = 0;
                healthy.length = 0;
                infected.length = 0;
                installed.length = 0;
                while (size > 0 && visitors.length > 0) {
                    group.push(visitors.pop());
                    size--;
                }
                shuffle(group, rng);
                // Identify the healthy/recovered, the infected, and those with apps.
                for (var j = 0; j < group.length; j++) {
                    var person = people[group[j]];
                    if ((person.status & STATUS_INFECTED) !== 0) {
                        infected.push(person);
                    }
                    else if ((person.status & STATUS_IMMUNE) === 0) {
                        healthy.push(person);
                    }
                    if (trace && (person.attrs & PERSON_APP_INSTALLED) !== 0) {
                        installed.push(person);
                    }
                }
                // If there are any infected, try and infect the healthy.
                if (infected.length > 0 && healthy.length > 0) {
                    for (var j = 0; j < healthy.length; j++) {
                        for (var k = 0; k < infected.length; k++) {
                            if (rng.next() <= infectionRisk) {
                                var from = infected[k];
                                healthy[j].infect(day, from.gen + 1);
                                from.spread += 1;
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
    };
    Simulation.prototype.queueNext = function () {
        var _this = this;
        if (IN_BROWSER) {
            if (configDisplayed) {
                return;
            }
            handle = requestAnimationFrame(function () { return _this.next(); });
        }
        else {
            handle = setTimeout(function () { return _this.next(); }, 0);
        }
    };
    Simulation.prototype.run = function () {
        this.day = 0;
        this.period = 0;
        this.queueNext();
    };
    return Simulation;
}());
var Visualisation = /** @class */ (function () {
    function Visualisation(sim) {
        var canvas = $("viz");
        var ctx = canvas.getContext("2d");
        this.canvas = canvas;
        this.cfg = sim.cfg;
        this.ctx = ctx;
        this.sim = sim;
        this.setDimensions();
    }
    Visualisation.prototype.draw = function (people) {
        if (true) {
            return;
        }
        var ctx = this.ctx;
        var layout = this.layout;
        var side = layout[0];
        var midpoint = side / 2;
        // let radius = midpoint
        // if (radius > 1000) {
        //   radius -= 0
        // }
        var clusters = this.sim.clusters;
        var rng = new RNG("layout");
        var radius = 10;
        ctx.clearRect(0, 0, layout[1], layout[2]);
        var seen = new Set();
        var spacing = 50;
        var spacedRadius = radius * 2;
        var counts = {};
        for (var i = 0; i < people.length; i++) {
            var person = people[i];
            var id = person.clusters[0];
            var status_2 = person.status;
            if (status_2 === STATUS_HEALTHY) {
                //   const
                ctx.fillStyle = VIZ_COLOUR_HEALTHY;
            }
            else if ((status_2 & STATUS_INFECTED) !== 0) {
                ctx.fillStyle = VIZ_COLOUR_INFECTED;
            }
            else if ((status_2 & STATUS_RECOVERED) !== 0) {
                ctx.fillStyle = VIZ_COLOUR_RECOVERED;
            }
            else if ((status_2 & STATUS_DEAD) !== 0) {
                ctx.fillStyle = VIZ_COLOUR_DEAD;
            }
        }
        // for (let i = 0; i < people.length; i++) {
        //   const person = people[i]
        //   const status = person.status
        //   const cluster = clusters[person.clusters[0]]
        //   let x = cluster.x
        //   let y = cluster.y
        //   if (rng.next() > 0.5) {
        //     x += Math.floor(rng.next() * spacing) + spacedRadius
        //   } else {
        //     x -= Math.floor(rng.next() * spacing) - spacedRadius
        //   }
        //   if (rng.next() > 0.5) {
        //     y += Math.floor(rng.next() * spacing) + spacedRadius
        //   } else {
        //     y -= Math.floor(rng.next() * spacing) - spacedRadius
        //   }
        //   ctx.beginPath()
        //   //   ctx.arc(person.x, person.y, radius, 0, 2 * Math.PI)
        //   //   ctx.arc(x, y, radius, 0, 2 * Math.PI)
        //   if (status === STATUS_HEALTHY) {
        //     ctx.fillStyle = VIZ_COLOUR_HEALTHY
        //   } else if ((status & STATUS_INFECTED) !== 0) {
        //     ctx.fillStyle = VIZ_COLOUR_INFECTED
        //   } else if ((status & STATUS_IMMUNE) !== 0) {
        //     ctx.fillStyle = VIZ_COLOUR_IMMUNE
        //   } else if ((status & STATUS_DEAD) !== 0) {
        //     ctx.fillStyle = VIZ_COLOUR_DEAD
        //   }
        //   ctx.fillRect(x, y, radius, radius)
        //   // ctx.fillRect(person.x, person.y, 4, 4)
        //   //   ctx.fill()
        // }
    };
    Visualisation.prototype.setDimensions = function () {
        var canvas = this.canvas;
        var info = $("info");
        var height = document.body.clientHeight - info.scrollHeight;
        var width = document.body.clientWidth;
        canvas.height = height;
        canvas.width = width;
        canvas.style.height = height + "px";
        canvas.style.width = width + "px";
        this.height = height;
        this.width = width;
        this.updatePositions();
    };
    Visualisation.prototype.updatePositions = function () {
        var cwidth = 2 * CLUSTER_WIDTH + CLUSTER_PADDING;
        var cheight = CLUSTER_HEIGHT + CLUSTER_PADDING;
        var height = this.height;
        var rows = Math.floor((height - CLUSTER_PADDING) / cheight);
        var rng = new RNG("positions");
        var width = this.width;
        var clusters = this.sim.clusters.slice(0);
        var columns = 0;
        var street = 0;
        for (street = 100; street >= 10; street--) {
            columns = Math.floor((width - street) / (cwidth + street));
            if (2 * columns * rows >= clusters.length) {
                break;
            }
            if (street === 10) {
                clusters = clusters.slice(0, 2 * columns * rows);
                break;
            }
        }
        var lastCol = 2 * columns;
        var width1 = CLUSTER_PADDING + CLUSTER_WIDTH;
        var col = -1;
        var maxX = 0;
        var maxY = 0;
        var row = 0;
        shuffle(clusters, rng);
        for (var i = 0; i < clusters.length; i++) {
            var cluster = clusters[i];
            col++;
            if (col === lastCol) {
                col = 0;
                row++;
            }
            if (col % 2 === 0) {
                cluster.x = Math.floor(col / 2) * (cwidth + street) + street;
            }
            else {
                cluster.x = Math.floor(col / 2) * (cwidth + street) + street + width1;
            }
            cluster.y = row * cheight + CLUSTER_PADDING;
            if (cluster.x > maxX) {
                maxX = cluster.x;
            }
            if (cluster.y > maxY) {
                maxY = cluster.y;
            }
        }
        maxX += CLUSTER_WIDTH + street;
        maxY += CLUSTER_HEIGHT + CLUSTER_PADDING;
        // Do a second pass to "center" the visualisation. This could be done with
        // more upfront calculations, but this is a lot cleaner.
        var padH = Math.floor((this.width - maxX) / 2);
        var padV = Math.floor((this.height - maxY) / 2);
        for (var i = 0; i < clusters.length; i++) {
            var cluster = clusters[i];
            cluster.x += padH;
            cluster.y += padV;
        }
        this.clusters = clusters;
        var ctx = this.ctx;
        ctx.fillStyle = COLOUR_HEALTHY;
        ctx.imageSmoothingEnabled = false;
        ctx.lineWidth = 1;
        for (var i = 0; i < clusters.length; i++) {
            var cluster = clusters[i];
            ctx.fillRect(cluster.x, cluster.y, CLUSTER_WIDTH, CLUSTER_HEIGHT);
        }
    };
    return Visualisation;
}());
// Derived from https://github.com/willscott/zipfian
var ZipfDistribution = /** @class */ (function () {
    function ZipfDistribution(min, max) {
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
function defaultConfig() {
    return {
        // the portion of people who have the app installed at the start
        appInstalled: 1 / 3,
        // distribution of the number of clusters for a person
        clusterCount: new ZipfDistribution(1, 20),
        // distribution of the number of "primary" members in a cluster
        clusterSize: new PoissonDistribution(20, 1, 50),
        // the portion of the population that can be tested
        dailyTestCapacity: 0.005,
        // number of days to run the simulation
        days: 300,
        // the likelihood of a SafetyScore user being okay with visiting a non-gate-kept cluster
        exposedVisit: 0.5,
        // likelihood of dying once infected
        fatalityRisk: 0.01,
        // likelihood of visiting a "foreign" cluster during a period
        foreignClusterVisit: 0.2,
        // likelihood of infection from outside the population
        foreignImports: 0.001,
        // the portion of clusters who gate-keep access via SafetyScore
        gatekeptClusters: 1 / 3,
        // the SafetyScore level needed to access a gate-kept cluster
        gatekeptThreshold: 50,
        // distribution of the group size within a cluster for a single period
        groupSize: new PoissonDistribution(2.5, 2, 20),
        // distribution of the number of people in a household [not used yet]
        household: new PoissonDistribution(2.1, 1, 6),
        // distribution of illness days after incubation
        illness: new NormalDistribution(10.5, 7),
        // distribution of the days of natural immunity
        immunity: new NormalDistribution(238, 0),
        // likelihood of someone getting infected during a single contact
        infectionRisk: 0.01,
        // likelihood of someone installing SafetyScore for visiting a foreign gate-kept cluster
        installForeign: 0.65,
        // likelihood of someone installing SafetyScore for visiting an own gate-kept cluster
        installOwn: 0.95,
        // likelihood of a self-isolating person staying at home for any given period during the day
        isolation: 0.9,
        // number of days a person should self-isolate
        isolationDays: 21,
        // the SafetyScore level below which one is notified to self-isolate and test
        isolationThreshold: 50,
        // total number of people
        population: 10000,
        // number of days before becoming infectious
        preInfectiousDays: 3,
        // number of days of being infectious before possibly becoming symptomatic
        preSymptomaticInfectiousDays: 3,
        // likelihood of visiting a public cluster when visiting a foreign cluster
        publicClusterVisit: 0.15,
        // portion of clusters which are public
        publicClusters: 0.15,
        // use sampling to speed up what's shown in the visualisation
        sampleVisualisation: true,
        // likelihood of a symptomatic person self-attesting [not used yet]
        selfAttestation: 0.5,
        // relative weight of viral tokens from a self-attestation [not used yet]
        selfAttestationWeight: 0.1,
        // likelihood of a notified person self-isolating
        selfIsolation: 0.9,
        // the portion of people who become symptomatic
        symptomatic: 0.2,
        // the distribution of the delay days between symptomatic/notified and testing
        testDelay: new PoissonDistribution(2, 1, 10),
        // likelihood of a person getting themselves tested if symptomatic/notified
        testing: 0.6,
    };
}
function defaultConfigDefinition() {
    var cfg = defaultConfig.toString();
    var start = cfg.indexOf("{", cfg.indexOf("{") + 1);
    var end = cfg.indexOf("};");
    cfg = cfg
        .slice(start, end)
        .trim()
        .split(",\n ")
        .join(",\n\n ")
        .split("        ")
        .join("    ");
    return cfg + "\n}";
}
function displayConfig() {
    if (configDisplayed) {
        return;
    }
    configDisplayed = true;
    if (!currentConfigDefinition) {
        currentConfigDefinition = defaultConfigDefinition();
    }
    if (!$config) {
        $config = $("config");
        $mirror = $("mirror");
    }
    $config.value = currentConfigDefinition;
    updateMirror(currentConfigDefinition);
    $("overlay").style.display = "block";
    $config.focus();
    $config.scrollTop = 0;
    $config.setSelectionRange(0, 0);
}
function downloadImage() {
    var graph = currentGraph;
    var elemWidth = Math.max(1, Math.floor(graph.width / graph.cfg.days));
    var width = elemWidth * graph.cfg.days;
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");
    var src = graph.ctx.getImageData(0, 0, width, graph.height);
    canvas.height = graph.height;
    canvas.width = width;
    ctx.putImageData(src, 0, 0);
    var data = canvas.toDataURL("image/png", 1);
    var link = document.createElement("a");
    link.href = data.replace("image/png", "image/octet-stream");
    var filename = "simulation";
    switch (graph.cfg.traceMethod) {
        case TRACE_NONE:
            filename += "-zero-interventions";
            break;
        case TRACE_APPLE_GOOGLE:
            filename += "-apple-google-api";
            break;
        case TRACE_SAFETYSCORE:
            filename += "-safetyscore";
            break;
    }
    filename += "-" + Date.now() + ".png";
    link.download = filename;
    link.click();
}
function genSVG(colors) {
    var out = ["<svg>"];
    out.push("</svg>");
    console.log(out.join(""));
}
function getCmdOpt(flag, fallback) {
    var idx = process.argv.indexOf(flag);
    if (idx === -1) {
        return fallback;
    }
    return process.argv[idx + 1];
}
function getConfig() {
    if (!currentConfig) {
        currentConfig = __assign(__assign({}, defaultConfig()), { output: "console", traceMethod: TRACE_NONE });
    }
    return currentConfig;
}
function getMean(dist) {
    var rng = new RNG("mean");
    var val = 0;
    for (var i = 0; i < 10000; i++) {
        val += dist.sample(rng);
    }
    return val / 10000;
}
function getTraceMethod(s) {
    var traceMethod;
    switch (s) {
        case "apple-google":
            traceMethod = TRACE_APPLE_GOOGLE;
            break;
        case "none":
            traceMethod = TRACE_NONE;
            break;
        case "safetyscore":
            traceMethod = TRACE_SAFETYSCORE;
            break;
        default:
            throw "Unknown trace method: " + s;
    }
    return traceMethod;
}
function getZeta(n, theta) {
    var sum = 0;
    for (var i = 0; i < n; i++) {
        sum += 1 / Math.pow(i + 1, theta);
    }
    return sum;
}
function handleInlayClick(e) {
    e.stopPropagation();
}
function handleKeyboard(e) {
    if (configDisplayed) {
        if (e.code === "Escape") {
            handleOverlayClick();
        }
        else if (e.ctrlKey && e.code === "Enter") {
            updateConfig();
        }
        return;
    }
    if (e.code === "KeyE") {
        displayConfig();
        return;
    }
    if (e.code === "KeyM") {
        var $options = $("options");
        var val = $options.selectedIndex;
        if (val === 2) {
            $options.selectedIndex = 0;
        }
        else {
            $options.selectedIndex = val + 1;
        }
        triggerSimulation();
        return;
    }
    if (e.code === "KeyR") {
        randSuffix = Date.now();
        triggerSimulation();
        return;
    }
}
function handleOverlayClick() {
    if (!configDisplayed) {
        return;
    }
    configDisplayed = false;
    $("error").style.display = "none";
    $("overlay").style.display = "none";
    if (currentSim) {
        currentSim.queueNext();
    }
}
function handleResize() {
    setTimeout(function () {
        if (currentGraph) {
            currentGraph.setDimensions();
        }
        if (currentViz) {
            currentViz.setDimensions();
        }
    }, 100);
}
function includes(array, value) {
    for (var i = 0; i < array.length; i++) {
        if (array[i] === value) {
            return true;
        }
    }
    return false;
}
function printBar(infected, recovered, dead, total, width) {
    var iwidth = Math.round((infected / total) * width);
    var rwidth = Math.round((recovered / total) * width);
    var dwidth = Math.round((dead / total) * width);
    var hwidth = width - iwidth - rwidth - dwidth;
    var line = "\u001b[31;1m" + "█".repeat(iwidth) + "\u001b[0m";
    line += "\u001b[32;1m" + "█".repeat(hwidth) + "\u001b[0m";
    line += "\u001b[38;5;230m" + "█".repeat(rwidth) + "\u001b[0m";
    line += "\u001b[38;5;250m" + "█".repeat(dwidth) + "\u001b[0m";
    console.log(line);
}
function printDistribution(dist) {
    var e_1, _a;
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
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
}
function runSimulation(cfg) {
    if (IN_BROWSER) {
        $("download").style.display = "none";
    }
    if (handle) {
        if (IN_BROWSER) {
            cancelAnimationFrame(handle);
        }
        else {
            clearTimeout(handle);
        }
    }
    var sim = new Simulation(cfg);
    currentSim = sim;
    sim.init();
    sim.run();
}
function scrollEditor() {
    $mirror.scrollTop = $config.scrollTop;
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
    if (!configDisplayed) {
        return;
    }
    updateMirror($config.value);
}
function triggerSimulation() {
    var $options = $("options");
    var traceMethod = getTraceMethod($options.options[$options.selectedIndex].value);
    runSimulation(__assign(__assign({}, getConfig()), { traceMethod: traceMethod }));
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
    if (!configDisplayed) {
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
    currentConfig = cfg;
    currentConfigDefinition = definition;
    configDisplayed = false;
    $("overlay").style.display = "none";
    triggerSimulation();
}
function updateMirror(src) {
    var code = Prism.highlight(src, Prism.languages.javascript);
    $mirror.innerHTML = code;
}
function validateConfig(cfg) {
    var v = new ConfigValidator(cfg);
    v.validateBoolean(["sampleVisualisation"]);
    v.validateDistribution([
        "clusterCount",
        "clusterSize",
        "groupSize",
        "household",
        "illness",
        "immunity",
        "testDelay",
    ]);
    v.validateNumber([
        "days",
        "isolationDays",
        "population",
        "preInfectiousDays",
        "preSymptomaticInfectiousDays",
    ]);
    v.validatePercentage([
        "appInstalled",
        "dailyTestCapacity",
        "exposedVisit",
        "fatalityRisk",
        "foreignClusterVisit",
        "foreignImports",
        "gatekeptClusters",
        "infectionRisk",
        "installForeign",
        "installOwn",
        "isolation",
        "publicClusterVisit",
        "publicClusters",
        "selfAttestation",
        "selfAttestationWeight",
        "selfIsolation",
        "symptomatic",
        "testing",
    ]);
    v.validateScore(["gatekeptThreshold", "isolationThreshold"]);
    v.checkFields();
    return cfg;
}
function main() {
    if (IN_BROWSER) {
        document.addEventListener("keyup", handleKeyboard);
        $("config").addEventListener("keyup", syncEditor);
        $("config").addEventListener("scroll", scrollEditor);
        $("download").addEventListener("click", downloadImage);
        $("edit-config").addEventListener("click", displayConfig);
        $("inlay").addEventListener("click", handleInlayClick);
        $("options").addEventListener("change", triggerSimulation);
        $("overlay").addEventListener("click", handleOverlayClick);
        $("update-config").addEventListener("click", updateConfig);
        triggerSimulation();
    }
    else {
        var colors = getCmdOpt("--colors", "default");
        var output = getCmdOpt("--output", "console");
        var traceMethod = getTraceMethod(getCmdOpt("--method", "none"));
        runSimulation(__assign(__assign({}, getConfig()), { output: output, traceMethod: traceMethod }));
        if (output === "svg") {
            genSVG(colors);
        }
    }
}
if (IN_BROWSER) {
    window.addEventListener("load", main);
    window.addEventListener("resize", handleResize);
}
else {
    main();
}
