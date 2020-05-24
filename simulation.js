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
// Determine host environment.
var IN_BROWSER = typeof window !== "undefined";
// Attribute values.
var ATTR_APP_INSTALLED = 1;
var ATTR_SYMPTOMATIC = 2;
// Constants relating to the visualisations.
var CLUSTER_HEIGHT = 24;
var CLUSTER_PADDING = 6;
var CLUSTER_WIDTH = 24;
var COLOUR_DEAD = "#444444";
var COLOUR_HEALTHY = "#8bb4b8";
var COLOUR_IMMUNE = "#009d51";
// const COLOUR_IMMUNE = "#444444"
var COLOUR_INFECTED = "#ff3945";
var VIZ_COLOUR_DEAD = COLOUR_DEAD;
var VIZ_COLOUR_HEALTHY = COLOUR_HEALTHY;
var VIZ_COLOUR_IMMUNE = COLOUR_IMMUNE;
var VIZ_COLOUR_INFECTED = COLOUR_INFECTED;
// const VIZ_COLOUR_DEAD = "#444444"
// const VIZ_COLOUR_HEALTHY = "#8bb4b8"
// const VIZ_COLOUR_IMMUNE = "#009d51"
// const VIZ_COLOUR_INFECTED = "#ff3945"
// const VIZ_COLOUR_DEAD = "#dcdcdc"
// const VIZ_COLOUR_HEALTHY = "#b3e5ea"
// const VIZ_COLOUR_IMMUNE = "#00fc86"
// const VIZ_COLOUR_INFECTED = "#ffd1d2"
var VIZ_PAD = 20;
var VIZ_PAD_2 = 2 * VIZ_PAD;
// const COLOR_DEAD = "#444444"
// const COLOR_HEALTHY = "#009d51"
// const COLOR_IMMUNE = "#b45cff"
// const COLOR_INFECTED = "#ff3945"
// const COLOR_VIZ_HEALTHY = "#8bb4b8"
// Status values.
var STATUS_HEALTHY = 0;
var STATUS_INFECTED = 1;
var STATUS_CONTAGIOUS = 2;
var STATUS_ISOLATED = 4;
var STATUS_IMMUNE = 8;
var STATUS_DEAD = 16;
// Trace methods.
var TRACE_NONE = 0;
var TRACE_FIRST_DEGREE = 1;
var TRACE_SAFETYSCORE = 2;
// Time spent in different environments.
var CLUSTER_PERIODS = 8;
var HOUSEHOLD_PERIODS = 8;
var TOTAL_PERIODS = CLUSTER_PERIODS + HOUSEHOLD_PERIODS;
var currentConfig;
var currentConfigDefinition;
var currentGraph;
var currentSim;
var currentViz;
var handle;
var settingsDisplayed = false;
var $config;
var $mirror;
var Graph = /** @class */ (function () {
    function Graph(cfg) {
        var canvas = $("graph");
        var ctx = canvas.getContext("2d");
        ctx.globalCompositeOperation = "destination-over";
        ctx.imageSmoothingEnabled = false;
        var elems = [
            $("infected"),
            $("healthy"),
            $("immune"),
            $("dead"),
            $("day"),
        ];
        elems[0].style.color = COLOUR_INFECTED;
        elems[1].style.color = COLOUR_HEALTHY;
        elems[2].style.color = COLOUR_IMMUNE;
        elems[3].style.color = COLOUR_DEAD;
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
        var width = 1;
        var curX = width * day;
        var prevX = width * prevDay;
        // Draw the dead.
        ctx.fillStyle = COLOUR_DEAD;
        ctx.fillRect(prevX, 0, 1, height);
        // Draw the immune.
        ctx.fillStyle = COLOUR_IMMUNE;
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
        rem -= stats.immune / population;
        values.push(rem);
        this.values.push(values);
        var day = this.values.length - 1;
        $[0].innerText = stats.infected.toString();
        $[1].innerText = stats.healthy.toString();
        $[2].innerText = stats.immune.toString();
        $[3].innerText = stats.dead.toString();
        $[4].innerText = day.toString();
        this.draw(day);
    };
    return Graph;
}());
var NormalDistribution = /** @class */ (function () {
    function NormalDistribution(mean, min) {
        this.min = min || 0;
        this.range = 2 * mean;
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
        sample = Math.round((sample / 10 + 0.5) * this.range);
        return sample;
    };
    NormalDistribution.prototype.sample = function (rng) {
        while (true) {
            var val = this.rand(rng);
            if (val >= this.min && val <= this.range) {
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
        this.id = id;
        this.sim = sim;
        this.status = STATUS_HEALTHY;
    }
    Person.prototype.appInstalled = function () {
        return (this.attrs & ATTR_APP_INSTALLED) !== 0;
    };
    Person.prototype.infect = function (today) {
        if ((this.status & STATUS_INFECTED) !== 0) {
            return;
        }
        this.status |= STATUS_INFECTED;
    };
    Person.prototype.infected = function () {
        return (this.status & STATUS_INFECTED) !== 0;
    };
    Person.prototype.installApp = function () {
        this.attrs |= ATTR_APP_INSTALLED;
    };
    Person.prototype.notInfected = function () {
        return (this.status & STATUS_INFECTED) === 0;
    };
    Person.prototype.symptomatic = function () {
        return (this.attrs & ATTR_SYMPTOMATIC) !== 0;
    };
    Person.prototype.updateStatus = function () {
        return (this.status & STATUS_INFECTED) !== 0;
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
    }
    Simulation.prototype.init = function () {
        var cfg = this.cfg;
        var rng = new RNG("init");
        // Generate people with custom attributes.
        var people = [];
        var personID = 0;
        for (var i_1 = 0; i_1 < cfg.population; i_1++) {
            var attrs = 0;
            if (rng.next() <= cfg.appInstalled) {
                attrs |= ATTR_APP_INSTALLED;
            }
            if (rng.next() <= cfg.symptomatic) {
                attrs |= ATTR_SYMPTOMATIC;
            }
            var person = new Person(attrs, personID++, this);
            people.push(person);
        }
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
        var clusterID = 0;
        var clusterPeople = people.slice(0);
        shuffle(clusterPeople, rng);
        i = 0;
        while (i < cfg.population) {
            var members = [];
            var size = cfg.cluster.sample(rng);
            for (var j = 0; j < size; j++) {
                var person = clusterPeople[i++];
                members.push(person.id);
                person.clusters.push(clusterID);
                if (i === cfg.population) {
                    break;
                }
            }
            var cluster = {
                members: members,
                public: rng.next() <= cfg.publicClusters,
                x: 0,
                y: 0,
            };
            clusters.push(cluster);
            clusterID++;
        }
        this.clusters = clusters;
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
        // Create graph and visualisation.
        if (IN_BROWSER) {
            this.graph = new Graph(cfg);
            this.viz = new Visualisation(this);
            currentGraph = this.graph;
            currentViz = this.viz;
        }
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
        else {
            this.nextPeriod();
        }
        this.queueNext();
    };
    Simulation.prototype.nextDay = function () {
        this.day++;
        var cfg = this.cfg;
        var day = this.day;
        var method = this.cfg.traceMethod;
        var people = this.people;
        var rng = new RNG("day-" + this.day);
        // See if anyone is going to get infected from foreign importation risk.
        for (var i = 0; i < cfg.population; i++) {
            var person = people[i];
            if (person.infected()) {
                // person.updateStatus(day, method)
                if (rng.next() <= 0.01) {
                    person.status = STATUS_IMMUNE;
                }
            }
            if (person.status === STATUS_DEAD) {
                continue;
            }
            if (person.notInfected()) {
                if (rng.next() <= cfg.foreignImportationRisk) {
                    person.infect(day);
                    //   console.log(person.status)
                    //   console.log(`Infected ${person.id}`)
                }
                else {
                    if (rng.next() <= 0.000001) {
                        person.status = STATUS_DEAD;
                    }
                }
            }
        }
        // Generate the daily stats.
        var stats = {
            dead: 0,
            healthy: 0,
            immune: 0,
            infected: 0,
        };
        for (var i = 0; i < cfg.population; i++) {
            var status_1 = people[i].status;
            if (status_1 === STATUS_HEALTHY) {
                stats.healthy++;
            }
            else if ((status_1 & STATUS_INFECTED) !== 0) {
                stats.infected++;
            }
            else if ((status_1 & STATUS_IMMUNE) !== 0) {
                stats.immune++;
            }
            else if ((status_1 & STATUS_DEAD) !== 0) {
                stats.dead++;
            }
        }
        if (IN_BROWSER) {
            this.viz.draw(people);
            this.graph.update(stats);
        }
        else {
            console.log(stats);
        }
    };
    Simulation.prototype.nextPeriod = function () {
        this.period++;
        if (this.period === CLUSTER_PERIODS) {
            this.period = 0;
        }
    };
    Simulation.prototype.queueNext = function () {
        var _this = this;
        if (IN_BROWSER) {
            if (settingsDisplayed) {
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
            else if ((status_2 & STATUS_IMMUNE) !== 0) {
                ctx.fillStyle = VIZ_COLOUR_IMMUNE;
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
        appInstalled: 0.2,
        // distribution of the number of members in a cluster
        cluster: new PoissonDistribution(20, 1, 50),
        // distribution of the contacts a peer has within a cluster for a single period
        clusterContact: new PoissonDistribution(2.5, 2, 20),
        // distribution of the number of clusters for a person
        clusterCount: new ZipfDistribution(1, 20),
        // likelihood of visiting a "foreign" cluster during a period
        clusterVisit: 0.4,
        // the portion of the population that can be tested
        dailyTestCapacity: 0.001,
        // number of days to run the simulation
        days: 730,
        // likelihood of dying once infected
        fatalityRisk: 0.01,
        // daily likelihood of an individual getting infected from outside the population
        foreignImportationRisk: 0.003,
        // the portion of clusters who gate-keep access via SafetyScore
        gatekeptClusters: 0.2,
        // the SafetyScore level needed to access a gate-kept cluster
        gatekeptThreshold: 50,
        // distribution of the number of people in a household
        household: new PoissonDistribution(2.1, 1, 6),
        // distribution of illness days after being incubation and pre-symptomatic infectiousness
        illness: new NormalDistribution(21, 14),
        // distribution of the days of natural immunity
        immunity: new NormalDistribution(238),
        // the number of tokens given out to a known infected person
        initialTokens: 10000,
        // likelihood of someone getting infected during a single contact
        infectionRisk: 0.2,
        // likelihood of someone installing SafetyScore for visiting a gate-kept cluster
        install: 0.8,
        // likelihood of a self-isolating person staying at home for any given period during the day
        isolation: 0.8,
        // total number of people
        population: 10000,
        // number of days before becoming infectious
        preInfectiousDays: 2,
        // number of days of being infectious before possibly becoming symptomatic
        preSymptomaticInfectiousDays: 2,
        // likelihood of visiting a public cluster when visiting a cluster other than your own
        publicClusterVisit: 0.6,
        // portion of clusters which are public
        publicClusters: 0.15,
        // use sampling to speed up what's shown in the visualisation
        sampleVisualisation: true,
        // the portion of people who become symptomatic
        symptomatic: 0.1,
        // the distribution of the delay days between symptomatic/notified and testing
        testDelay: new PoissonDistribution(4, 1, 10),
        // the SafetyScore level below which one is prioritised for testing
        testThreshold: 50,
        // likelihood of a person getting themselves tested if symptomatic/notified
        testing: 0.9,
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
function displaySettings() {
    if (settingsDisplayed) {
        return;
    }
    settingsDisplayed = true;
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
    var width = graph.values.length - 1;
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");
    var src = graph.ctx.getImageData(0, 0, width, graph.height);
    canvas.height = graph.height;
    canvas.width = width;
    ctx.putImageData(src, 0, 0);
    var data = canvas.toDataURL("image/png", 1);
    var link = document.createElement("a");
    link.href = data.replace("image/png", "image/octet-stream");
    var filename = "epimodel";
    switch (graph.cfg.traceMethod) {
        case TRACE_NONE:
            filename += "-zero-interventions";
            break;
        case TRACE_FIRST_DEGREE:
            filename += "-contact-tracing";
            break;
        case TRACE_SAFETYSCORE:
            filename += "-safetyscore";
            break;
    }
    filename += "-" + Date.now() + ".png";
    link.download = filename;
    link.click();
}
function getConfig() {
    if (!currentConfig) {
        currentConfig = __assign(__assign({}, defaultConfig()), { traceMethod: TRACE_SAFETYSCORE });
    }
    return currentConfig;
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
    if (settingsDisplayed) {
        if (e.code === "Escape") {
            handleOverlayClick();
        }
        if (e.ctrlKey && e.code === "Enter") {
            updateConfig();
        }
        return;
    }
    if (e.code === "KeyE") {
        displaySettings();
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
    }
}
function handleOverlayClick() {
    if (!settingsDisplayed) {
        return;
    }
    settingsDisplayed = false;
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
    for (var _i = 0, _a = Object.keys(bins); _i < _a.length; _i++) {
        var i = _a[_i];
        console.log(i + "," + bins[i]);
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
// Adapted from
// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array, rng) {
    var _a;
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(rng.next() * (i + 1));
        _a = [array[j], array[i]], array[i] = _a[0], array[j] = _a[1];
    }
}
function triggerSimulation() {
    var $options = $("options");
    var traceMethod = TRACE_NONE;
    switch ($options.options[$options.selectedIndex].value) {
        case "contacttracing":
            traceMethod = TRACE_FIRST_DEGREE;
            break;
        case "none":
            traceMethod = TRACE_NONE;
            break;
        case "safetyscore":
            traceMethod = TRACE_SAFETYSCORE;
            break;
    }
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
    if (!settingsDisplayed) {
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
    settingsDisplayed = false;
    $("overlay").style.display = "none";
    triggerSimulation();
}
function validateConfig(cfg) {
    validateDistribution(cfg, [
        "cluster",
        "clusterContact",
        "clusterCount",
        "household",
        "illness",
        "immunity",
        "testDelay",
    ]);
    validateNumber(cfg, [
        "days",
        "initialTokens",
        "population",
        "preInfectiousDays",
        "preSymptomaticInfectiousDays",
    ]);
    validatePercentage(cfg, [
        "appInstalled",
        "dailyTestCapacity",
        "clusterVisit",
        "fatalityRisk",
        "foreignImportationRisk",
        "gatekeptClusters",
        "infectionRisk",
        "install",
        "isolation",
        "publicClusterVisit",
        "publicClusters",
        "symptomatic",
        "testing",
    ]);
    validateScore(cfg, ["gatekeptThreshold", "testThreshold"]);
    return cfg;
}
function validateDistribution(cfg, fields) {
    fields.forEach(function (field) {
        var val = cfg[field];
        if (val === undefined) {
            throw "The value for \"" + field + "\" cannot be undefined";
        }
        if (!val.sample) {
            throw "The value for \"" + field + "\" must be a Distribution";
        }
    });
}
function validateNumber(cfg, fields) {
    fields.forEach(function (field) {
        var val = cfg[field];
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
}
function validatePercentage(cfg, fields) {
    fields.forEach(function (field) {
        var val = cfg[field];
        if (typeof val !== "number") {
            throw "The value for \"" + field + "\" must be a number";
        }
        if (val < 0 || val > 1) {
            throw "The value for \"" + field + "\" must be between 0 and 1";
        }
    });
}
function validateScore(cfg, fields) {
    fields.forEach(function (field) {
        var val = cfg[field];
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
}
function syncEditor() {
    if (!settingsDisplayed) {
        return;
    }
    updateMirror($config.value);
}
function updateMirror(src) {
    var code = Prism.highlight(src, Prism.languages.javascript);
    $mirror.innerHTML = code;
}
function scrollEditor() {
    $mirror.scrollTop = $config.scrollTop;
}
function main() {
    if (IN_BROWSER) {
        document.addEventListener("keyup", handleKeyboard);
        $("config").addEventListener("keyup", syncEditor);
        $("config").addEventListener("scroll", scrollEditor);
        $("download").addEventListener("click", downloadImage);
        $("inlay").addEventListener("click", handleInlayClick);
        $("options").addEventListener("change", triggerSimulation);
        $("overlay").addEventListener("click", handleOverlayClick);
        $("settings").addEventListener("click", displaySettings);
        $("update-config").addEventListener("click", updateConfig);
        triggerSimulation();
    }
    else {
        runSimulation(getConfig());
    }
}
if (IN_BROWSER) {
    window.addEventListener("load", main);
    window.addEventListener("resize", handleResize);
}
else {
    main();
}
