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
// Determine host environment.
var IN_BROWSER = typeof self === "object";
var IN_WORKER = typeof importScripts === "function";
// Attribute values for clusters.
var CLUSTER_GATEKEPT = 1;
var CLUSTER_PUBLIC = 2;
// Time spent in clusters during a day.
var CLUSTER_PERIODS = 8;
// User interface colours.
var COLOUR_DEAD = "#444444";
var COLOUR_HEALTHY = "#8bb4b8";
var COLOUR_INFECTED = "#ff3945";
var COLOUR_RECOVERED = "#009d51";
// Intervention methods.
var METHOD_APPLE_GOOGLE = 1;
var METHOD_FREE_MOVEMENT = 2;
var METHOD_LOCKDOWN = 3;
var METHOD_SAFETYSCORE = 4;
// Attribute values for people.
var PERSON_APP_FOREIGN_CLUSTER = 1;
var PERSON_APP_INSTALLED = 2;
var PERSON_APP_OWN_CLUSTER = 4;
var PERSON_KEY_WORKER = 8;
var PERSON_SYMPTOMATIC = 16;
// Status values.
var STATUS_HEALTHY = 1;
var STATUS_INFECTED = 2;
var STATUS_CONTAGIOUS = 4;
var STATUS_RECOVERED = 8;
var STATUS_IMMUNE = 16;
var STATUS_DEAD = 32;
var STATUS_ISOLATED = 64;
var STATUS_QUARANTINED = 128;
// Visual ordering of methods.
var METHODS = [
    METHOD_FREE_MOVEMENT,
    METHOD_APPLE_GOOGLE,
    METHOD_SAFETYSCORE,
    METHOD_LOCKDOWN,
];
var configDisplayed = false;
var ctrl;
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
        this.cfg = defaultConfig();
        this.definition = defaultConfigDefinition();
        this.id = 1;
        this.rand = 1591164094719;
        this.paused = false;
        this.simList = [];
        this.sims = {};
    }
    Controller.prototype.initBrowser = function () {
        this.$main = $("main");
        this.initSims(METHODS, true);
        this.setDimensions();
        this.run();
        this.redraw();
    };
    Controller.prototype.initNodeJS = function (method) {
        var cfg = this.cfg;
        this.initSims([method], false);
        this.run();
    };
    Controller.prototype.initSims = function (methods, setupUI) {
        for (var i = 0; i < methods.length; i++) {
            var method = methods[i];
            var sim = new Simulation(this, method);
            if (setupUI) {
                this.$main.appendChild(sim.setupUI());
            }
            this.simList.push(sim);
            this.sims[method] = sim;
        }
    };
    Controller.prototype.pause = function () {
        this.paused = true;
    };
    Controller.prototype.randomise = function () {
        this.id++;
        this.rand = Date.now();
        console.log("Using random seed: " + this.rand);
        this.run();
    };
    Controller.prototype.redraw = function () {
        if (!this.paused) {
            for (var i = 0; i < this.simList.length; i++) {
                this.simList[i].render();
            }
        }
        this.handle = 0;
    };
    Controller.prototype.requestRedraw = function () {
        var _this = this;
        if (this.handle) {
            return;
        }
        this.handle = requestAnimationFrame(function () { return _this.redraw(); });
    };
    Controller.prototype.resume = function () {
        this.paused = false;
        this.requestRedraw();
    };
    Controller.prototype.run = function () {
        var cfg = this.cfg;
        for (var i = 0; i < this.simList.length; i++) {
            var sim = this.simList[i];
            if (!sim.hidden) {
                sim.run(this.definition, cfg.days, this.id, this.rand);
            }
        }
    };
    Controller.prototype.runNew = function (cfg, definition) {
        this.cfg = cfg;
        this.definition = definition;
        this.id++;
        this.run();
    };
    Controller.prototype.setDimensions = function () {
        for (var i = 0; i < this.simList.length; i++) {
            this.simList[i].setDimensions();
        }
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
        this.cfg = eval("(" + req.cfg + ")");
        this.id = req.id;
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
        // Make certain clusters gatekept and install SafetyScore to all members.
        if (this.method === METHOD_SAFETYSCORE) {
            var installed = 0;
            var convert = new Set();
            var limit = Math.round(cfg.gatekeptClusters * cfg.population);
            var gatekept = clusters.slice(0);
            shuffle(gatekept, rng.shuffle);
            for (i = 0; i < gatekept.length; i++) {
                if (installed >= limit) {
                    break;
                }
                var cluster = gatekept[i];
                cluster.attrs |= CLUSTER_GATEKEPT;
                for (var j = 0; j < cluster.members.length; j++) {
                    var id = cluster.members[j];
                    var member = people[id];
                    if (!convert.has(id)) {
                        installed++;
                        convert.add(id);
                        if (member.installSafetyScore(0)) {
                            installBase++;
                        }
                    }
                }
            }
            if (cfg.installHousehold) {
                for (i = 0; i < cfg.population; i++) {
                    var person = people[i];
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
        var meanContacts = getMean(cfg.clusterCount) * getMean(cfg.clusterSize) +
            getMean(cfg.groupSize) *
                CLUSTER_PERIODS *
                traceDays *
                cfg.visitForeignCluster;
        this.computed = {
            dailyForeign: cfg.foreignImports / cfg.population,
            dailyTests: Math.round(cfg.dailyTestCapacity * cfg.population),
            inactivityPenalty: 100 / traceDays,
            infectiousDays: cfg.preSymptomaticInfectiousDays + Math.round(getMean(cfg.illness)),
            installForeign: cfg.installForeign / cfg.days,
            meanContacts: meanContacts,
            traceDays: traceDays,
        };
        // Initialise other properties.
        this.day = 0;
        this.isolatedPeriods = 0;
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
                    if (rng.isolationLockdown.next() <= cfg.isolationLockdown) {
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
                if ((cluster.attrs & CLUSTER_GATEKEPT) === 0) {
                    // If the person has SafetyScore and the cluster isn't gate-kept, see
                    // if they'll consider visiting it. We don't consider this an isolated
                    // period as it's a free choice by the individual.
                    if ((person.attrs & PERSON_APP_INSTALLED) !== 0) {
                        if (!(rng.exposedVisit.next() <= cfg.exposedVisit)) {
                            continue;
                        }
                    }
                }
                else {
                    // For a gate-kept cluster, if the user doesn't have the app
                    // installed, see if they will consider installing it.
                    if ((person.attrs & PERSON_APP_INSTALLED) === 0) {
                        person.attrs |= PERSON_APP_FOREIGN_CLUSTER;
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
                sendMessage({ id: this.id, stats: stats });
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
        this.days = 0;
        this.dirty = true;
        this.heading = getMethodLabel(method);
        this.height = 300;
        this.hidden = false;
        this.method = method;
        this.results = [];
        this.width = 0;
    }
    Simulation.prototype.download = function () {
        var cfg = eval("(" + this.definition + ")");
        var data = "";
        if (cfg.outputFormat === "json") {
            data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.results));
        }
        else if (cfg.outputFormat === "png") {
            var canvas = document.createElement("canvas");
            var widthElem = Math.max(1, Math.floor(this.width / (cfg.days - 1)));
            var width = widthElem * (cfg.days - 1);
            var ctx = canvas.getContext("2d");
            var src = this.ctx.getImageData(0, 0, width, this.height);
            canvas.height = this.height;
            canvas.width = width;
            ctx.imageSmoothingEnabled = false;
            ctx.putImageData(src, 0, 0);
            data = canvas
                .toDataURL("image/png", 1)
                .replace("image/png", "image/octet-stream");
        }
        var link = document.createElement("a");
        link.download = "simulation-" + getMethodID(this.method) + "-" + Date.now() + "." + cfg.outputFormat;
        link.href = data;
        link.click();
    };
    Simulation.prototype.handleMessage = function (resp) {
        if (this.id !== resp.id) {
            return;
        }
        this.results.push(resp.stats);
        this.markDirty();
        if (this.results.length === this.days) {
            if (this.worker) {
                this.worker.terminate();
                this.worker = undefined;
            }
            show(this.$download);
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
        this.hidden = true;
        this.$heading.style.paddingTop = "11px";
        hide(this.$content);
        hide(this.$download);
        hide(this.$run);
        hide(this.$settings);
        var $visibilityImage = h("img", { src: "show.svg", alt: "Show" });
        this.$visibilityImage.replaceWith($visibilityImage);
        this.$visibilityImage = $visibilityImage;
        var $visibilitySpan = h("span", null, "Show Simulation");
        this.$visibilitySpan.replaceWith($visibilitySpan);
        this.$visibilitySpan = $visibilitySpan;
        this.ctrl.setDimensions();
    };
    Simulation.prototype.hideInfo = function () {
        hide(this.$info);
    };
    Simulation.prototype.markDirty = function () {
        this.dirty = true;
        this.ctrl.requestRedraw();
    };
    Simulation.prototype.render = function () {
        if (!IN_BROWSER) {
            return;
        }
        if (this.hidden || configDisplayed || !this.dirty) {
            return;
        }
        this.dirty = false;
        this.renderSummary();
        this.renderGraph();
    };
    Simulation.prototype.renderInfo = function (e) {
        var _this = this;
        var bounds = this.$canvas.getBoundingClientRect();
        var pos = e.clientX - bounds.left;
        if (pos < 0 || pos > this.width) {
            if (this.handle) {
                this.hideInfo();
            }
            return;
        }
        var width = Math.max(1, Math.floor(this.width / (this.days - 1)));
        var day = Math.floor(pos / width);
        if (day >= this.results.length) {
            if (this.handle) {
                this.hideInfo();
            }
            return;
        }
        if (this.handle) {
            clearTimeout(this.handle);
        }
        var stats = this.results[day];
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
    Simulation.prototype.renderGraph = function () {
        if (!IN_BROWSER) {
            return;
        }
        var ctx = this.ctx;
        var height = this.height;
        var results = this.results;
        // Draw the background.
        ctx.fillStyle = "#eeeeee";
        ctx.fillRect(0, 0, this.width, height);
        // Exit early if we don't have enough data to draw a graph.
        if (results.length < 3) {
            return;
        }
        var days = results.length;
        var last = days - 1;
        var stats = results[last];
        var total = stats.dead + stats.healthy + stats.infected + stats.recovered;
        var width = Math.max(1, Math.floor(this.width / (this.days - 1)));
        for (var day = 1; day < days; day++) {
            var cur = results[day];
            var prevDay = day - 1;
            var prev = results[prevDay];
            var curX = width * day;
            var prevX = width * prevDay;
            var stat = 0;
            var prevStat = 0;
            // Draw the dead.
            ctx.fillStyle = COLOUR_DEAD;
            ctx.fillRect(prevX, 0, width, height);
            stat += cur.dead / total;
            prevStat += prev.dead / total;
            // Draw the recovered.
            ctx.fillStyle = COLOUR_RECOVERED;
            ctx.beginPath();
            ctx.moveTo(prevX, prevStat * height);
            ctx.lineTo(curX, stat * height);
            ctx.lineTo(curX, height);
            ctx.lineTo(prevX, height);
            ctx.fill();
            stat += cur.recovered / total;
            prevStat += prev.recovered / total;
            // Draw the healthy.
            ctx.fillStyle = COLOUR_HEALTHY;
            ctx.beginPath();
            ctx.moveTo(prevX, prevStat * height);
            ctx.lineTo(curX, stat * height);
            ctx.lineTo(curX, height);
            ctx.lineTo(prevX, height);
            ctx.fill();
            stat += cur.healthy / total;
            prevStat += prev.healthy / total;
            // Draw the infected.
            ctx.fillStyle = COLOUR_INFECTED;
            ctx.beginPath();
            ctx.moveTo(prevX, prevStat * height);
            ctx.lineTo(curX, stat * height);
            ctx.lineTo(curX, height);
            ctx.lineTo(prevX, height);
            ctx.fill();
        }
    };
    Simulation.prototype.renderSummary = function () {
        if (!IN_BROWSER) {
            return;
        }
        if (this.results.length === 0) {
            return;
        }
        var results = this.results;
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
        var $summary = (h("div", { class: "summary" },
            h("div", null,
                "Days",
                h("div", { class: "right" }, days)),
            h("div", null,
                "Isolated",
                h("div", { class: "right value" }, percent(isolated))),
            h("div", null,
                "Healthy",
                h("div", { class: "right value-healthy" }, percent(healthy))),
            h("div", null,
                "Infected",
                h("div", { class: "right value-infected" }, percent(infected))),
            h("div", null,
                "Dead",
                h("div", { class: "right value-dead" }, percent(dead)))));
        this.$summary.replaceWith($summary);
        this.$summary = $summary;
    };
    Simulation.prototype.run = function (cfg, days, id, rand) {
        var _this = this;
        if (this.worker) {
            this.worker.terminate();
        }
        if (this.hidden) {
            this.hidden = false;
            show(this.$root);
        }
        this.days = days;
        this.definition = cfg;
        this.id = id;
        this.results = [];
        this.worker = new AbstractedWorker("./simulation.js");
        this.worker.onMessage(function (msg) { return _this.handleMessage(msg); });
        this.worker.postMessage({ cfg: cfg, id: id, method: this.method, rand: rand });
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
        this.$canvas.width = width;
        this.$canvas.style.height = this.height + "px";
        this.$canvas.style.width = width + "px";
        this.width = width;
        this.markDirty();
    };
    Simulation.prototype.setupUI = function () {
        var _this = this;
        var $canvas = h("canvas", { class: "graph", height: this.height });
        $canvas.addEventListener("mousemove", function (e) { return _this.renderInfo(e); });
        $canvas.addEventListener("mouseout", function () { return _this.hideInfo(); });
        var $download = (h("div", { class: "action" },
            h("img", { src: "download.svg", alt: "Download" }),
            h("span", null, "Download File")));
        $download.addEventListener("click", function () { return _this.download(); });
        hide($download);
        var $heading = h("div", { class: "heading" }, this.heading);
        var $info = h("div", { class: "info" });
        var $run = (h("div", { class: "action" },
            h("img", { class: "refresh", src: "refresh.svg", alt: "Refresh" }),
            h("span", null, "Run New Simulation")));
        $run.addEventListener("click", function (e) { return _this.ctrl.randomise(); });
        var $settings = (h("div", { class: "action" },
            h("img", { src: "settings.svg", alt: "Settings" }),
            h("span", null, "Edit Config")));
        $settings.addEventListener("click", displayConfig);
        var $summary = h("div", { class: "summary" });
        var $visibilityImage = h("img", { src: "hide.svg", alt: "Hide" });
        var $visibilitySpan = h("span", null, "Hide Simulation");
        var $visibility = (h("div", { class: "action" },
            $visibilityImage,
            $visibilitySpan));
        $visibility.addEventListener("click", function (e) { return _this.toggle(); });
        var $content = (h("div", { class: "content" },
            $info,
            $summary,
            $canvas));
        var $root = (h("div", { class: "simulation" },
            $heading,
            $visibility,
            $settings,
            $run,
            $download,
            h("div", { class: "clear" }),
            $content,
            h("div", { class: "clear" })));
        var ctx = $canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        this.ctx = ctx;
        this.$canvas = $canvas;
        this.$content = $content;
        this.$download = $download;
        this.$heading = $heading;
        this.$info = $info;
        this.$root = $root;
        this.$run = $run;
        this.$settings = $settings;
        this.$summary = $summary;
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
        var $visibilitySpan = h("span", null, "Hide Simulation");
        this.$visibilitySpan.replaceWith($visibilitySpan);
        this.$visibilitySpan = $visibilitySpan;
        var ctrl = this.ctrl;
        ctrl.setDimensions();
        this.run(ctrl.definition, ctrl.cfg.days, ctrl.id, ctrl.rand);
    };
    Simulation.prototype.toggle = function () {
        if (this.hidden) {
            this.show();
        }
        else {
            this.hide();
        }
    };
    return Simulation;
}());
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
function defaultConfig() {
    return {
        // the portion of people who have an Apple/Google-style Contact Tracing app installed
        appleGoogleInstalled: 0.6,
        // distribution of the number of clusters for a person
        clusterCount: new ZipfDistribution({ min: 1, max: 20 }),
        // distribution of the number of "primary" members in a cluster
        clusterSize: new PoissonDistribution({ mean: 20, min: 1, max: 50 }),
        // the portion of the population that can be tested
        dailyTestCapacity: 0.005,
        // number of days to run the simulation
        days: 400,
        // the likelihood of a SafetyScore user being okay with visiting a non-gate-kept cluster
        exposedVisit: 0.1,
        // likelihood of dying once infected
        fatalityRisk: 0.01,
        // daily likelihood of someone in the whole population getting infected from outside the population
        foreignImports: 0.06,
        // the portion of clusters who gate-keep access via SafetyScore
        gatekeptClusters: 0.6,
        // the SafetyScore level needed to access a gate-kept cluster
        gatekeptThreshold: 50,
        // distribution of the group size within a cluster for a single period
        groupSize: new PoissonDistribution({ mean: 2.5, min: 2, max: 20 }),
        // distribution of the number of people in a household [not used yet]
        household: new PoissonDistribution({ mean: 2.1, min: 1, max: 6 }),
        // distribution of illness days after incubation
        illness: new NormalDistribution({ mean: 10.5, min: 7 }),
        // distribution of the days of natural immunity
        immunity: new NormalDistribution({ mean: 238, min: 0 }),
        // likelihood of someone getting infected during a single contact
        infectionRisk: 0.01,
        // likelihood of someone installing SafetyScore for visiting a foreign gate-kept cluster
        installForeign: 0,
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
        isolationSymptomatic: 1,
        // portion of the population who will not be isolated during lockdown
        keyWorkers: 0.16,
        // the number of infected people, below which a lockdown could end
        lockdownEnd: 5,
        // number of days the number of infected people must be below "lockdownEnd" before lockdown ends
        lockdownEndWindow: 14,
        // the number of infected people which will trigger a lockdown
        lockdownStart: 15,
        // format of the generated output file, can be "json" or "png"
        outputFormat: "png",
        // total number of people
        population: 10000,
        // number of days before becoming infectious
        preInfectiousDays: 3,
        // number of days of being infectious before possibly becoming symptomatic
        preSymptomaticInfectiousDays: 3,
        // portion of clusters which are public
        publicClusters: 0.15,
        // the portion of people who have SafetyScore installed at the start
        safetyScoreInstalled: 0,
        // a multiplicative weighting factor for second-degree tokens
        secondDegreeWeight: 1,
        // likelihood of a symptomatic person self-attesting
        selfAttestation: 0,
        // the portion of people who become symptomatic
        symptomatic: 0.2,
        // the distribution of the delay days between symptomatic/notified and testing
        testDelay: new PoissonDistribution({ mean: 2, min: 1, max: 10 }),
        // test all key workers
        testKeyWorkers: false,
        // likelihood of a key worker getting tested
        testKeyWorker: 0.1,
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
    if (configDisplayed || !ctrl) {
        return;
    }
    configDisplayed = true;
    ctrl.pause();
    if (!$config) {
        $config = $("config");
        $mirror = $("mirror");
    }
    $config.value = ctrl.definition;
    updateMirror(ctrl.definition);
    $("overlay").style.display = "block";
    $config.focus();
    $config.scrollTop = 0;
    $config.setSelectionRange(0, 0);
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
function getZeta(n, theta) {
    var sum = 0;
    for (var i = 0; i < n; i++) {
        sum += 1 / Math.pow(i + 1, theta);
    }
    return sum;
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
    if (configDisplayed) {
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
}
function handleOverlayClick(e) {
    if (e) {
        e.stopPropagation();
    }
    if (!configDisplayed) {
        return;
    }
    configDisplayed = false;
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
    if (!configDisplayed) {
        return;
    }
    updateMirror($config.value);
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
    configDisplayed = false;
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
    v.validateNumber([
        "days",
        "isolationDays",
        "lockdownEnd",
        "lockdownEndWindow",
        "lockdownStart",
        "population",
        "preInfectiousDays",
        "preSymptomaticInfectiousDays",
    ]);
    v.validatePercentage([
        "appleGoogleInstalled",
        "dailyTestCapacity",
        "exposedVisit",
        "fatalityRisk",
        "foreignImports",
        "gatekeptClusters",
        "infectionRisk",
        "installForeign",
        "isolationEffectiveness",
        "isolationLikelihood",
        "isolationLockdown",
        "isolationSymptomatic",
        "keyWorkers",
        "publicClusters",
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
    v.validateScore(["gatekeptThreshold", "isolationThreshold"]);
    v.validateStringValue("outputFormat", ["json", "png", "svg"]);
    v.checkFields();
    return cfg;
}
function runMulti(times, method) {
    var e_2, _a;
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
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (results_1_1 && !results_1_1.done && (_a = results_1.return)) _a.call(results_1);
        }
        finally { if (e_2) throw e_2.error; }
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
    window.addEventListener("load", main);
    window.addEventListener("resize", handleResize);
}
else {
    main();
}