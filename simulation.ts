// Determine host environment.
const IN_BROWSER = typeof window !== "undefined"

// Attribute values.
const ATTR_APP_INSTALLED = 1
const ATTR_SYMPTOMATIC = 2

// Constants relating to the visualisations.
const CLUSTER_HEIGHT = 24
const CLUSTER_PADDING = 6
const CLUSTER_WIDTH = 24
const COLOUR_DEAD = "#444444"
const COLOUR_HEALTHY = "#8bb4b8"
const COLOUR_IMMUNE = "#009d51"
// const COLOUR_IMMUNE = "#444444"
const COLOUR_INFECTED = "#ff3945"
const VIZ_COLOUR_DEAD = COLOUR_DEAD
const VIZ_COLOUR_HEALTHY = COLOUR_HEALTHY
const VIZ_COLOUR_IMMUNE = COLOUR_IMMUNE
const VIZ_COLOUR_INFECTED = COLOUR_INFECTED
// const VIZ_COLOUR_DEAD = "#444444"
// const VIZ_COLOUR_HEALTHY = "#8bb4b8"
// const VIZ_COLOUR_IMMUNE = "#009d51"
// const VIZ_COLOUR_INFECTED = "#ff3945"
// const VIZ_COLOUR_DEAD = "#dcdcdc"
// const VIZ_COLOUR_HEALTHY = "#b3e5ea"
// const VIZ_COLOUR_IMMUNE = "#00fc86"
// const VIZ_COLOUR_INFECTED = "#ffd1d2"
const VIZ_PAD = 20
const VIZ_PAD_2 = 2 * VIZ_PAD

// const COLOR_DEAD = "#444444"
// const COLOR_HEALTHY = "#009d51"
// const COLOR_IMMUNE = "#b45cff"
// const COLOR_INFECTED = "#ff3945"
// const COLOR_VIZ_HEALTHY = "#8bb4b8"

// Status values.
const STATUS_HEALTHY = 0
const STATUS_INFECTED = 1
const STATUS_CONTAGIOUS = 2
const STATUS_ISOLATED = 4
const STATUS_IMMUNE = 8
const STATUS_DEAD = 16

// Trace methods.
const TRACE_NONE = 0
const TRACE_FIRST_DEGREE = 1
const TRACE_SAFETYSCORE = 2

// Time spent in different environments.
const CLUSTER_PERIODS = 8
const HOUSEHOLD_PERIODS = 8
const TOTAL_PERIODS = CLUSTER_PERIODS + HOUSEHOLD_PERIODS

let currentConfig: Config
let currentConfigDefinition: string
let currentGraph: Graph
let currentSim: Simulation
let currentViz: Visualisation
let handle: number
let settingsDisplayed = false

let $config: HTMLTextAreaElement
let $mirror: HTMLPreElement

interface Cluster {
  members: number[]
  public: boolean
  x: number
  y: number
}

interface Config {
  appInstalled: number
  cluster: Distribution
  clusterContact: Distribution
  clusterCount: Distribution
  clusterVisit: number
  dailyTestCapacity: number
  days: number
  fatalityRisk: number
  foreignImportationRisk: number
  gatekeptClusters: number
  gatekeptThreshold: number
  household: Distribution
  illness: Distribution
  immunity: Distribution
  initialTokens: number
  infectionRisk: number
  install: number
  isolation: number
  population: number
  preInfectiousDays: number
  preSymptomaticInfectiousDays: number
  publicClusterVisit: number
  publicClusters: number
  sampleVisualisation: boolean
  symptomatic: number
  testDelay: Distribution
  testThreshold: number
  testing: number
  traceMethod: number
}

interface Distribution {
  sample(rng: RNG): number
}

interface Household {
  members: number[]
  x: number
  y: number
}

interface Stats {
  dead: number
  healthy: number
  immune: number
  infected: number
}

type CustomConfig = Without<Config, "traceMethod">

type Without<T, K> = Pick<T, Exclude<keyof T, K>>

class Graph {
  $: HTMLElement[]
  canvas: HTMLCanvasElement
  cfg: Config
  ctx: CanvasRenderingContext2D
  height: number
  values: number[][]
  width: number

  constructor(cfg: Config) {
    const canvas = $("graph") as HTMLCanvasElement
    const ctx = canvas.getContext("2d")!
    ctx.globalCompositeOperation = "destination-over"
    ctx.imageSmoothingEnabled = false
    const elems = [
      $("infected"),
      $("healthy"),
      $("immune"),
      $("dead"),
      $("day"),
    ]
    elems[0].style.color = COLOUR_INFECTED
    elems[1].style.color = COLOUR_HEALTHY
    elems[2].style.color = COLOUR_IMMUNE
    elems[3].style.color = COLOUR_DEAD
    this.$ = elems
    this.canvas = canvas
    this.cfg = cfg
    this.ctx = ctx
    this.values = [[1, 0, 0]]
    this.setDimensions()
  }

  draw(day: number) {
    const ctx = this.ctx
    const cur = this.values[day]
    const height = this.height
    const prevDay = day - 1
    const prev = this.values[prevDay]
    const width = 1
    const curX = width * day
    const prevX = width * prevDay
    // Draw the dead.
    ctx.fillStyle = COLOUR_DEAD
    ctx.fillRect(prevX, 0, 1, height)
    // Draw the immune.
    ctx.fillStyle = COLOUR_IMMUNE
    ctx.beginPath()
    ctx.moveTo(prevX, prev[2] * height)
    ctx.lineTo(curX, cur[2] * height)
    ctx.lineTo(curX, height)
    ctx.lineTo(prevX, height)
    ctx.fill()
    // Draw the healthy.
    ctx.fillStyle = COLOUR_HEALTHY
    ctx.beginPath()
    ctx.moveTo(prevX, prev[1] * height)
    ctx.lineTo(curX, cur[1] * height)
    ctx.lineTo(curX, height)
    ctx.lineTo(prevX, height)
    ctx.fill()
    // Draw the infected.
    ctx.fillStyle = COLOUR_INFECTED
    ctx.beginPath()
    ctx.moveTo(prevX, prev[0] * height)
    ctx.lineTo(curX, cur[0] * height)
    ctx.lineTo(curX, height)
    ctx.lineTo(prevX, height)
    ctx.fill()
  }

  redraw() {
    const days = this.values.length
    if (days === 1) {
      return
    }
    this.ctx.clearRect(0, 0, this.width, this.height)
    for (let i = 1; i < days; i++) {
      this.draw(i)
    }
  }

  setDimensions() {
    const canvas = this.canvas
    const info = $("info")
    const style = getComputedStyle(info)
    const infoWidth = trimpx(style.width) + 2 * trimpx(style.paddingLeft)
    const height = info.scrollHeight
    const width = document.body.clientWidth - infoWidth - 48
    canvas.height = height
    canvas.width = width
    canvas.style.height = `${height}px`
    canvas.style.width = `${width}px`
    this.height = height
    this.width = width
    this.redraw()
  }

  update(stats: Stats) {
    const $ = this.$
    const population = this.cfg.population
    const values: number[] = []
    let rem = 1 - stats.infected / population
    values.push(rem)
    rem -= stats.healthy / population
    values.push(rem)
    rem -= stats.immune / population
    values.push(rem)
    this.values.push(values)
    const day = this.values.length - 1
    $[0].innerText = stats.infected.toString()
    $[1].innerText = stats.healthy.toString()
    $[2].innerText = stats.immune.toString()
    $[3].innerText = stats.dead.toString()
    $[4].innerText = day.toString()
    this.draw(day)
  }
}

class NormalDistribution {
  min: number
  range: number

  constructor(mean: number, min?: number) {
    this.min = min || 0
    this.range = 2 * mean
  }

  rand(rng: RNG) {
    let u1 = 0
    let u2 = 0
    while (u1 === 0) {
      u1 = rng.next()
    }
    while (u2 === 0) {
      u2 = rng.next()
    }
    let sample = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
    sample = Math.round((sample / 10 + 0.5) * this.range)
    return sample
  }

  sample(rng: RNG) {
    while (true) {
      const val = this.rand(rng)
      if (val >= this.min && val <= this.range) {
        return val
      }
    }
  }
}

class Person {
  attrs: number
  clusters: number[]
  contacts: number[][]
  household: number
  householdContacts: number[]
  id: number
  immunityEndDay: number
  infectedDay: number
  infectionEndDay: number
  sim: Simulation
  status: number
  x: number
  y: number

  constructor(attrs: number, id: number, sim: Simulation) {
    this.attrs = attrs
    this.clusters = []
    this.contacts = []
    this.id = id
    this.sim = sim
    this.status = STATUS_HEALTHY
  }

  appInstalled() {
    return (this.attrs & ATTR_APP_INSTALLED) !== 0
  }

  infect(today: number) {
    if ((this.status & STATUS_INFECTED) !== 0) {
      return
    }
    this.status |= STATUS_INFECTED
  }

  infected() {
    return (this.status & STATUS_INFECTED) !== 0
  }

  installApp() {
    this.attrs |= ATTR_APP_INSTALLED
  }

  notInfected() {
    return (this.status & STATUS_INFECTED) === 0
  }

  symptomatic() {
    return (this.attrs & ATTR_SYMPTOMATIC) !== 0
  }

  updateStatus() {
    return (this.status & STATUS_INFECTED) !== 0
  }
}

// Derived from:
// https://stackoverflow.com/questions/1241555/algorithm-to-generate-poisson-and-binomial-random-numbers
class PoissonDistribution {
  limit: number
  min: number
  max: number

  constructor(mean: number, min: number, max: number) {
    this.limit = Math.exp(-mean)
    this.max = max
    this.min = min
  }

  rand(rng: RNG) {
    let k = 1
    let p = rng.next()
    while (p > this.limit) {
      k++
      p *= rng.next()
    }
    return k - 1
  }

  sample(rng: RNG) {
    while (true) {
      const val = this.rand(rng)
      if (val >= this.min && val <= this.max) {
        return val
      }
    }
  }
}

// RNG provides a seedable random number generator.
//
// Copyright (c) 2010, Johannes Baagøe <baagoe@baagoe.org>
// MIT License
//
// https://web.archive.org/web/20120124013936/http://baagoe.org/en/wiki/Better_random_numbers_for_javascript
class RNG {
  c: number
  s0: number
  s1: number
  s2: number

  constructor(seed: string) {
    let n = 0xefc8249d
    const mash = (data: string) => {
      for (let i = 0; i < data.length; i++) {
        n += data.charCodeAt(i)
        let h = 0.02519603282416938 * n
        n = h >>> 0
        h -= n
        h *= n
        n = h >>> 0
        h -= n
        n += h * 0x100000000 // 2^32
      }
      return (n >>> 0) * 2.3283064365386963e-10 // 2^-32
    }
    this.c = 1
    this.s0 = mash(" ")
    this.s1 = mash(" ")
    this.s2 = mash(" ")
    this.s0 -= mash(seed)
    if (this.s0 < 0) {
      this.s0 += 1
    }
    this.s1 -= mash(seed)
    if (this.s1 < 0) {
      this.s1 += 1
    }
    this.s2 -= mash(seed)
    if (this.s2 < 0) {
      this.s2 += 1
    }
  }

  next() {
    const t = 2091639 * this.s0 + this.c * 2.3283064365386963e-10 // 2^-32
    this.s0 = this.s1
    this.s1 = this.s2
    return (this.s2 = t - (this.c = t | 0))
  }
}

class Simulation {
  cfg: Config
  clusters: Cluster[]
  day: number
  graph: Graph
  households: Household[]
  people: Person[]
  period: number
  testQueue: number[]
  viz: Visualisation

  constructor(cfg: Config) {
    this.cfg = cfg
  }

  init() {
    const cfg = this.cfg
    const rng = new RNG("init")
    // Generate people with custom attributes.
    const people: Person[] = []
    let personID = 0
    for (let i = 0; i < cfg.population; i++) {
      let attrs = 0
      if (rng.next() <= cfg.appInstalled) {
        attrs |= ATTR_APP_INSTALLED
      }
      if (rng.next() <= cfg.symptomatic) {
        attrs |= ATTR_SYMPTOMATIC
      }
      const person = new Person(attrs, personID++, this)
      people.push(person)
    }
    this.people = people
    // Generate households and allocate people to households.
    const households: Household[] = []
    let i = 0
    let houseID = 0
    while (i < cfg.population) {
      const members: number[] = []
      const size = cfg.household.sample(rng)
      for (let j = 0; j < size; j++) {
        members.push(i++)
        if (i === cfg.population) {
          break
        }
      }
      for (let j = 0; j < members.length; j++) {
        const selfID = members[j]
        const self = people[selfID]
        const contacts = []
        for (let x = 0; x < members.length; x++) {
          const otherID = members[x]
          if (otherID === selfID) {
            continue
          }
          contacts.push(otherID)
        }
        self.household = houseID
        self.householdContacts = contacts
      }
      const house: Household = {
        members: members,
        x: 0,
        y: 0,
      }
      households.push(house)
      houseID++
    }
    this.households = households
    // Generate clusters and allocate a primary cluster for everyone.
    const clusters: Cluster[] = []
    let clusterID = 0
    let clusterPeople = people.slice(0)
    shuffle(clusterPeople, rng)
    i = 0
    while (i < cfg.population) {
      const members: number[] = []
      const size = cfg.cluster.sample(rng)
      for (let j = 0; j < size; j++) {
        const person = clusterPeople[i++]
        members.push(person.id)
        person.clusters.push(clusterID)
        if (i === cfg.population) {
          break
        }
      }
      const cluster: Cluster = {
        members: members,
        public: rng.next() <= cfg.publicClusters,
        x: 0,
        y: 0,
      }
      clusters.push(cluster)
      clusterID++
    }
    this.clusters = clusters
    // Assign additional clusters for some people.
    const totalClusters = clusters.length
    for (i = 0; i < cfg.population; i++) {
      const person = people[i]
      const size = cfg.clusterCount.sample(rng)
      if (size > 1) {
        for (let j = 1; j < size && j < totalClusters; j++) {
          let cluster = Math.floor(rng.next() * clusters.length)
          while (includes(person.clusters, cluster)) {
            cluster = Math.floor(rng.next() * clusters.length)
          }
          person.clusters.push(cluster)
        }
      }
    }
    // Create graph and visualisation.
    if (IN_BROWSER) {
      this.graph = new Graph(cfg)
      this.viz = new Visualisation(this)
      currentGraph = this.graph
      currentViz = this.viz
    }
  }

  next() {
    if (this.day === this.cfg.days) {
      if (IN_BROWSER) {
        $("download").style.display = "block"
      }
      return
    }
    if (this.period === 0) {
      this.nextDay()
    } else {
      this.nextPeriod()
    }
    this.queueNext()
  }

  nextDay() {
    this.day++
    const cfg = this.cfg
    const day = this.day
    const method = this.cfg.traceMethod
    const people = this.people
    const rng = new RNG(`day-${this.day}`)
    // See if anyone is going to get infected from foreign importation risk.
    for (let i = 0; i < cfg.population; i++) {
      const person = people[i]
      if (person.infected()) {
        // person.updateStatus(day, method)
        if (rng.next() <= 0.01) {
          person.status = STATUS_IMMUNE
        }
      }
      if (person.status === STATUS_DEAD) {
        continue
      }
      if (person.notInfected()) {
        if (rng.next() <= cfg.foreignImportationRisk) {
          person.infect(day)
          //   console.log(person.status)
          //   console.log(`Infected ${person.id}`)
        } else {
          if (rng.next() <= 0.000001) {
            person.status = STATUS_DEAD
          }
        }
      }
    }
    // Generate the daily stats.
    const stats = {
      dead: 0,
      healthy: 0,
      immune: 0,
      infected: 0,
    }
    for (let i = 0; i < cfg.population; i++) {
      const status = people[i].status
      if (status === STATUS_HEALTHY) {
        stats.healthy++
      } else if ((status & STATUS_INFECTED) !== 0) {
        stats.infected++
      } else if ((status & STATUS_IMMUNE) !== 0) {
        stats.immune++
      } else if ((status & STATUS_DEAD) !== 0) {
        stats.dead++
      }
    }
    if (IN_BROWSER) {
      this.viz.draw(people)
      this.graph.update(stats)
    } else {
      console.log(stats)
    }
  }

  nextPeriod() {
    this.period++
    if (this.period === CLUSTER_PERIODS) {
      this.period = 0
    }
  }

  queueNext() {
    if (IN_BROWSER) {
      if (settingsDisplayed) {
        return
      }
      handle = requestAnimationFrame(() => this.next())
    } else {
      handle = setTimeout(() => this.next(), 0)
    }
  }

  run() {
    this.day = 0
    this.period = 0
    this.queueNext()
  }
}

class Visualisation {
  cfg: Config
  canvas: HTMLCanvasElement
  clusters: Cluster[]
  ctx: CanvasRenderingContext2D
  height: number
  layout: number[]
  sim: Simulation
  width: number

  constructor(sim: Simulation) {
    const canvas = $("viz") as HTMLCanvasElement
    const ctx = canvas.getContext("2d")!
    this.canvas = canvas
    this.cfg = sim.cfg
    this.ctx = ctx
    this.sim = sim
    this.setDimensions()
  }

  draw(people: Person[]) {
    if (true) {
      return
    }
    const ctx = this.ctx
    const layout = this.layout
    const side = layout[0]
    const midpoint = side / 2
    // let radius = midpoint
    // if (radius > 1000) {
    //   radius -= 0
    // }
    const clusters = this.sim.clusters
    const rng = new RNG("layout")
    const radius = 10
    ctx.clearRect(0, 0, layout[1], layout[2])
    const seen = new Set()
    const spacing = 50
    const spacedRadius = radius * 2
    const counts = {}
    for (let i = 0; i < people.length; i++) {
      const person = people[i]
      const id = person.clusters[0]
      const status = person.status
      if (status === STATUS_HEALTHY) {
        //   const
        ctx.fillStyle = VIZ_COLOUR_HEALTHY
      } else if ((status & STATUS_INFECTED) !== 0) {
        ctx.fillStyle = VIZ_COLOUR_INFECTED
      } else if ((status & STATUS_IMMUNE) !== 0) {
        ctx.fillStyle = VIZ_COLOUR_IMMUNE
      } else if ((status & STATUS_DEAD) !== 0) {
        ctx.fillStyle = VIZ_COLOUR_DEAD
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
  }

  setDimensions() {
    const canvas = this.canvas
    const info = $("info")
    const height = document.body.clientHeight - info.scrollHeight
    const width = document.body.clientWidth
    canvas.height = height
    canvas.width = width
    canvas.style.height = `${height}px`
    canvas.style.width = `${width}px`
    this.height = height
    this.width = width
    this.updatePositions()
  }

  updatePositions() {
    const cwidth = 2 * CLUSTER_WIDTH + CLUSTER_PADDING
    const cheight = CLUSTER_HEIGHT + CLUSTER_PADDING
    const height = this.height
    const rows = Math.floor((height - CLUSTER_PADDING) / cheight)
    const rng = new RNG("positions")
    const width = this.width
    let clusters = this.sim.clusters.slice(0)
    let columns = 0
    let street = 0
    for (street = 100; street >= 10; street--) {
      columns = Math.floor((width - street) / (cwidth + street))
      if (2 * columns * rows >= clusters.length) {
        break
      }
      if (street === 10) {
        clusters = clusters.slice(0, 2 * columns * rows)
        break
      }
    }
    const lastCol = 2 * columns
    const width1 = CLUSTER_PADDING + CLUSTER_WIDTH
    let col = -1
    let maxX = 0
    let maxY = 0
    let row = 0
    shuffle(clusters, rng)
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]
      col++
      if (col === lastCol) {
        col = 0
        row++
      }
      if (col % 2 === 0) {
        cluster.x = Math.floor(col / 2) * (cwidth + street) + street
      } else {
        cluster.x = Math.floor(col / 2) * (cwidth + street) + street + width1
      }
      cluster.y = row * cheight + CLUSTER_PADDING
      if (cluster.x > maxX) {
        maxX = cluster.x
      }
      if (cluster.y > maxY) {
        maxY = cluster.y
      }
    }
    maxX += CLUSTER_WIDTH + street
    maxY += CLUSTER_HEIGHT + CLUSTER_PADDING
    // Do a second pass to "center" the visualisation. This could be done with
    // more upfront calculations, but this is a lot cleaner.
    const padH = Math.floor((this.width - maxX) / 2)
    const padV = Math.floor((this.height - maxY) / 2)
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]
      cluster.x += padH
      cluster.y += padV
    }
    this.clusters = clusters
    const ctx = this.ctx
    ctx.fillStyle = COLOUR_HEALTHY
    ctx.imageSmoothingEnabled = false
    ctx.lineWidth = 1
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]
      ctx.fillRect(cluster.x, cluster.y, CLUSTER_WIDTH, CLUSTER_HEIGHT)
    }
  }
}

// Derived from https://github.com/willscott/zipfian
class ZipfDistribution {
  eta: number
  items: number
  min: number
  zetan: number

  constructor(min: number, max: number) {
    this.items = max - min + 1
    this.min = min
    this.zetan = getZeta(this.items, 0.99)
    this.eta =
      (1 - Math.pow(2 / this.items, 0.01)) / (1 - getZeta(2, 0.99) / this.zetan)
  }

  sample(rng: RNG) {
    const u = rng.next()
    const uz = u * this.zetan
    if (uz < 1) {
      return this.min
    }
    return (
      this.min +
      Math.floor(this.items * Math.pow(this.eta * u - this.eta + 1, 100))
    )
  }
}

function $(id: string) {
  return document.getElementById(id)!
}

function defaultConfig(): CustomConfig {
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
    foreignImportationRisk: 0.003, // 0.00003,
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
  }
}

function defaultConfigDefinition() {
  let cfg = defaultConfig.toString()
  const start = cfg.indexOf("{", cfg.indexOf("{") + 1)
  const end = cfg.indexOf("};")
  cfg = cfg
    .slice(start, end)
    .trim()
    .split(",\n ")
    .join(",\n\n ")
    .split("        ")
    .join("    ")
  return cfg + "\n}"
}

function displaySettings() {
  if (settingsDisplayed) {
    return
  }
  settingsDisplayed = true
  if (!currentConfigDefinition) {
    currentConfigDefinition = defaultConfigDefinition()
  }
  if (!$config) {
    $config = $("config") as HTMLTextAreaElement
    $mirror = $("mirror") as HTMLPreElement
  }
  $config.value = currentConfigDefinition
  updateMirror(currentConfigDefinition)
  $("overlay").style.display = "block"
  $config.focus()
  $config.scrollTop = 0
  $config.setSelectionRange(0, 0)
}

function downloadImage() {
  const graph = currentGraph
  const width = graph.values.length - 1
  const canvas = document.createElement("canvas") as HTMLCanvasElement
  const ctx = canvas.getContext("2d")!
  const src = graph.ctx.getImageData(0, 0, width, graph.height)
  canvas.height = graph.height
  canvas.width = width
  ctx.putImageData(src, 0, 0)
  const data = canvas.toDataURL("image/png", 1)
  const link = document.createElement("a")
  link.href = data.replace("image/png", "image/octet-stream")
  let filename = "epimodel"
  switch (graph.cfg.traceMethod) {
    case TRACE_NONE:
      filename += "-zero-interventions"
      break
    case TRACE_FIRST_DEGREE:
      filename += "-contact-tracing"
      break
    case TRACE_SAFETYSCORE:
      filename += "-safetyscore"
      break
  }
  filename += `-${Date.now()}.png`
  link.download = filename
  link.click()
}

function getConfig(): Config {
  if (!currentConfig) {
    currentConfig = {...defaultConfig(), traceMethod: TRACE_SAFETYSCORE}
  }
  return currentConfig
}

function getZeta(n: number, theta: number) {
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += 1 / Math.pow(i + 1, theta)
  }
  return sum
}

function handleInlayClick(e: Event) {
  e.stopPropagation()
}

function handleKeyboard(e: KeyboardEvent) {
  if (settingsDisplayed) {
    if (e.code === "Escape") {
      handleOverlayClick()
    }
    if (e.ctrlKey && e.code === "Enter") {
      updateConfig()
    }
    return
  }
  if (e.code === "KeyE") {
    displaySettings()
  }
  if (e.code === "KeyM") {
    const $options = $("options") as HTMLSelectElement
    const val = $options.selectedIndex
    if (val === 2) {
      $options.selectedIndex = 0
    } else {
      $options.selectedIndex = val + 1
    }
    triggerSimulation()
  }
}

function handleOverlayClick() {
  if (!settingsDisplayed) {
    return
  }
  settingsDisplayed = false
  $("error").style.display = "none"
  $("overlay").style.display = "none"
  if (currentSim) {
    currentSim.queueNext()
  }
}

function handleResize() {
  setTimeout(() => {
    if (currentGraph) {
      currentGraph.setDimensions()
    }
    if (currentViz) {
      currentViz.setDimensions()
    }
  }, 100)
}

function includes<T>(array: Array<T>, value: T) {
  for (let i = 0; i < array.length; i++) {
    if (array[i] === value) {
      return true
    }
  }
  return false
}

function printBar(
  infected: number,
  recovered: number,
  dead: number,
  total: number,
  width: number
) {
  const iwidth = Math.round((infected / total) * width)
  const rwidth = Math.round((recovered / total) * width)
  const dwidth = Math.round((dead / total) * width)
  const hwidth = width - iwidth - rwidth - dwidth
  let line = "\u001b[31;1m" + "█".repeat(iwidth) + "\u001b[0m"
  line += "\u001b[32;1m" + "█".repeat(hwidth) + "\u001b[0m"
  line += "\u001b[38;5;230m" + "█".repeat(rwidth) + "\u001b[0m"
  line += "\u001b[38;5;250m" + "█".repeat(dwidth) + "\u001b[0m"
  console.log(line)
}

function printDistribution(dist: Distribution) {
  const bins: Record<string, number> = {}
  const rng = new RNG("dist")
  for (let i = 0; i < 100000; i++) {
    const val = dist.sample(rng)
    if (bins[val]) {
      bins[val] += 1
    } else {
      bins[val] = 1
    }
  }
  console.log("Value,Count")
  for (let i of Object.keys(bins)) {
    console.log(`${i},${bins[i]}`)
  }
}

function runSimulation(cfg: Config) {
  if (IN_BROWSER) {
    $("download").style.display = "none"
  }
  if (handle) {
    if (IN_BROWSER) {
      cancelAnimationFrame(handle)
    } else {
      clearTimeout(handle)
    }
  }
  const sim = new Simulation(cfg)
  currentSim = sim
  sim.init()
  sim.run()
}

// Adapted from
// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array: Array<any>, rng: RNG) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
}

function triggerSimulation() {
  const $options = $("options") as HTMLSelectElement
  let traceMethod = TRACE_NONE
  switch ($options.options[$options.selectedIndex].value) {
    case "contacttracing":
      traceMethod = TRACE_FIRST_DEGREE
      break
    case "none":
      traceMethod = TRACE_NONE
      break
    case "safetyscore":
      traceMethod = TRACE_SAFETYSCORE
      break
  }
  runSimulation({...getConfig(), traceMethod})
}

function trimpx(v: string) {
  if (!v.endsWith("px")) {
    throw new Error(`CSS unit value "${v}" does not end in "px"`)
  }
  return parseInt(v.slice(0, -2), 10)
}

function updateConfig(e?: Event) {
  if (e) {
    e.stopPropagation()
  }
  if (!settingsDisplayed) {
    return
  }
  const $config = $("config") as HTMLTextAreaElement
  const definition = $config.value
  let cfg: Config
  try {
    cfg = validateConfig(eval(`(${definition})`))
  } catch (err) {
    const $error = $("error")
    $error.innerText = err.toString()
    $error.style.display = "block"
    return
  }
  currentConfig = cfg
  currentConfigDefinition = definition
  settingsDisplayed = false
  $("overlay").style.display = "none"
  triggerSimulation()
}

function validateConfig(cfg: Config) {
  validateDistribution(cfg, [
    "cluster",
    "clusterContact",
    "clusterCount",
    "household",
    "illness",
    "immunity",
    "testDelay",
  ])
  validateNumber(cfg, [
    "days",
    "initialTokens",
    "population",
    "preInfectiousDays",
    "preSymptomaticInfectiousDays",
  ])
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
  ])
  validateScore(cfg, ["gatekeptThreshold", "testThreshold"])
  return cfg
}

function validateDistribution(cfg: Record<string, any>, fields: string[]) {
  fields.forEach((field) => {
    const val = cfg[field]
    if (val === undefined) {
      throw `The value for "${field}" cannot be undefined`
    }
    if (!val.sample) {
      throw `The value for "${field}" must be a Distribution`
    }
  })
}

function validateNumber(cfg: Record<string, any>, fields: string[]) {
  fields.forEach((field) => {
    const val = cfg[field]
    if (typeof val !== "number") {
      throw `The value for "${field}" must be a number`
    }
    if (Math.floor(val) !== val) {
      throw `The value for "${field}" must be a whole number`
    }
    if (val < 1) {
      throw `The value for "${field}" must be greater than 1`
    }
  })
}

function validatePercentage(cfg: Record<string, any>, fields: string[]) {
  fields.forEach((field) => {
    const val = cfg[field]
    if (typeof val !== "number") {
      throw `The value for "${field}" must be a number`
    }
    if (val < 0 || val > 1) {
      throw `The value for "${field}" must be between 0 and 1`
    }
  })
}

function validateScore(cfg: Record<string, any>, fields: string[]) {
  fields.forEach((field) => {
    const val = cfg[field]
    if (typeof val !== "number") {
      throw `The value for "${field}" must be a number`
    }
    if (Math.floor(val) !== val) {
      throw `The value for "${field}" must be a whole number`
    }
    if (val < 0 || val > 100) {
      throw `The value for "${field}" must be between 0 and 100`
    }
  })
}

declare namespace Prism {
  function highlight(code: string, lang: string): string
  let languages: Record<string, string>
}

function syncEditor() {
  if (!settingsDisplayed) {
    return
  }
  updateMirror($config.value)
}

function updateMirror(src: string) {
  const code = Prism.highlight(src, Prism.languages.javascript)
  $mirror.innerHTML = code
}

function scrollEditor() {
  $mirror.scrollTop = $config.scrollTop
}

function main() {
  if (IN_BROWSER) {
    document.addEventListener("keyup", handleKeyboard)
    $("config").addEventListener("keyup", syncEditor)
    $("config").addEventListener("scroll", scrollEditor)
    $("download").addEventListener("click", downloadImage)
    $("inlay").addEventListener("click", handleInlayClick)
    $("options").addEventListener("change", triggerSimulation)
    $("overlay").addEventListener("click", handleOverlayClick)
    $("settings").addEventListener("click", displaySettings)
    $("update-config").addEventListener("click", updateConfig)
    triggerSimulation()
  } else {
    runSimulation(getConfig())
  }
}

if (IN_BROWSER) {
  window.addEventListener("load", main)
  window.addEventListener("resize", handleResize)
} else {
  main()
}
