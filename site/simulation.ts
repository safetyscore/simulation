// Determine host environment.
const IN_BROWSER = typeof window !== "undefined"

// Attribute values for clusters.
const CLUSTER_GATEKEPT = 1
const CLUSTER_PUBLIC = 2

// Attribute values for people.
const PERSON_APP_FOREIGN_CLUSTER = 1
const PERSON_APP_INSTALLED = 2
const PERSON_APP_OWN_CLUSTER = 4
const PERSON_SYMPTOMATIC = 8

// Constants relating to the visualisations.
const CLUSTER_HEIGHT = 24
const CLUSTER_PADDING = 6
const CLUSTER_WIDTH = 24

const COLOUR_DEAD = "#444444"
const COLOUR_HEALTHY = "#8bb4b8"
const COLOUR_INFECTED = "#ff3945"
const COLOUR_RECOVERED = "#009d51"

const VIZ_COLOUR_DEAD = COLOUR_DEAD
const VIZ_COLOUR_HEALTHY = COLOUR_HEALTHY
const VIZ_COLOUR_INFECTED = COLOUR_INFECTED
const VIZ_COLOUR_RECOVERED = COLOUR_RECOVERED

// const COLOR_IMMUNE = "#b45cff"
// const VIZ_COLOUR_DEAD = "#dcdcdc"
// const VIZ_COLOUR_HEALTHY = "#b3e5ea"
// const VIZ_COLOUR_IMMUNE = "#00fc86"
// const VIZ_COLOUR_INFECTED = "#ffd1d2"

// Status values.
const STATUS_HEALTHY = 1
const STATUS_INFECTED = 2
const STATUS_CONTAGIOUS = 4
const STATUS_RECOVERED = 8
const STATUS_IMMUNE = 16
const STATUS_DEAD = 32
const STATUS_ISOLATED = 64

// Trace methods.
const TRACE_NONE = 0
const TRACE_APPLE_GOOGLE = 1
const TRACE_SAFETYSCORE = 2

// Time spent in different environments.
const CLUSTER_PERIODS = 8
const HOUSEHOLD_PERIODS = 8
const TOTAL_PERIODS = CLUSTER_PERIODS + HOUSEHOLD_PERIODS

let configDisplayed = false
let currentConfig: Config
let currentConfigDefinition: string
let currentGraph: Graph
let currentSim: Simulation
let currentViz: Visualisation
let handle: ReturnType<typeof setTimeout> | number
let randSuffix = 1590673685829
let result: Stats[] = []

let $config: HTMLTextAreaElement
let $mirror: HTMLPreElement

declare namespace Prism {
  function highlight(code: string, lang: string): string
  let languages: Record<string, string>
}

interface Cluster {
  attrs: number
  members: number[]
  x: number
  y: number
}

interface Config {
  appInstalled: number
  clusterCount: Distribution
  clusterSize: Distribution
  dailyTestCapacity: number
  days: number
  exposedVisit: number
  fatalityRisk: number
  foreignClusterVisit: number
  foreignImports: number
  gatekeptClusters: number
  gatekeptThreshold: number
  groupSize: Distribution
  household: Distribution
  illness: Distribution
  immunity: Distribution
  infectionRisk: number
  installForeign: number
  installOwn: number
  isolation: number
  isolationDays: number
  isolationThreshold: number
  output: string
  population: number
  preInfectiousDays: number
  preSymptomaticInfectiousDays: number
  publicClusterVisit: number
  publicClusters: number
  sampleVisualisation: boolean
  selfAttestation: number
  selfAttestationWeight: number
  selfIsolation: number
  symptomatic: number
  testDelay: Distribution
  testing: number
  traceMethod: number
}

interface Distribution {
  sample(rng: RNG): number
  max: number
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
  isolated: number
  recovered: number
}

type CustomConfig = Without<Config, "output" | "traceMethod">

type Without<T, K> = Pick<T, Exclude<keyof T, K>>

class ConfigValidator {
  cfg: Record<string, any>
  seen: Set<string>

  constructor(cfg: Config) {
    this.cfg = cfg
    this.seen = new Set()
  }

  checkFields() {
    const fields = Object.keys(this.cfg)
    const seen = this.seen
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]
      if (!seen.has(field)) {
        throw `Config has field "${field}" which hasn't been validated`
      }
    }
  }

  validate(fields: string[], validator: (field: string, val: any) => void) {
    fields.forEach((field) => {
      this.seen.add(field)
      const val = this.cfg[field]
      if (val === undefined) {
        throw `The value for "${field}" cannot be undefined`
      }
      validator(field, val)
    })
  }

  validateBoolean(fields: string[]) {
    this.validate(fields, (field, val) => {
      if (typeof val !== "boolean") {
        throw `The value for "${field}" must be a boolean`
      }
    })
  }

  validateDistribution(fields: string[]) {
    this.validate(fields, (field, val) => {
      if (!val.sample) {
        throw `The value for "${field}" must be a Distribution`
      }
    })
  }

  validateNumber(fields: string[]) {
    this.validate(fields, (field, val) => {
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

  validatePercentage(fields: string[]) {
    this.validate(fields, (field, val) => {
      if (typeof val !== "number") {
        throw `The value for "${field}" must be a number`
      }
      if (val < 0 || val > 1) {
        throw `The value for "${field}" must be between 0 and 1`
      }
    })
  }

  validateScore(fields: string[]) {
    this.validate(fields, (field, val) => {
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
}

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
      $("day"),
      $("dead"),
      $("recovered"),
      $("healthy"),
      $("infected"),
      $("isolated"),
    ]
    elems[1].style.color = COLOUR_DEAD
    elems[2].style.color = COLOUR_RECOVERED
    elems[3].style.color = COLOUR_HEALTHY
    elems[4].style.color = COLOUR_INFECTED
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
    const width = Math.max(1, Math.floor(this.width / this.cfg.days))
    const curX = width * day
    const prevX = width * prevDay
    // Draw the dead.
    ctx.fillStyle = COLOUR_DEAD
    ctx.fillRect(prevX, 0, width, height)
    // Draw the recovered.
    ctx.fillStyle = COLOUR_RECOVERED
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
    rem -= stats.recovered / population
    values.push(rem)
    this.values.push(values)
    const day = this.values.length - 1
    $[0].innerText = day.toString()
    $[1].innerText = stats.dead.toString()
    $[2].innerText = stats.recovered.toString()
    $[3].innerText = stats.healthy.toString()
    $[4].innerText = stats.infected.toString()
    $[5].innerText = stats.isolated.toString()
    this.draw(day)
  }
}

class NormalDistribution {
  max: number
  min: number

  constructor(mean: number, min?: number) {
    this.max = 2 * mean
    this.min = min || 0
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
    sample = Math.round((sample / 10 + 0.5) * this.max)
    return sample
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

class Person {
  attrs: number
  clusters: number[]
  contacts: number[][]
  gen: number
  household: number
  householdContacts: number[]
  id: number
  immunityEndDay: number
  infectedDay: number
  infectionEndDay: number
  installDate: number
  isolationEndDay: number
  score: number
  sim: Simulation
  spread: number
  status: number
  testDay: number
  tokens: number[][]
  x: number
  y: number

  constructor(attrs: number, id: number, sim: Simulation) {
    this.attrs = attrs
    this.clusters = []
    this.contacts = []
    this.gen = -1
    this.id = id
    this.infectedDay = 0
    this.infectionEndDay = 0
    this.immunityEndDay = 0
    this.installDate = 0
    this.isolationEndDay = 0
    this.score = 0
    this.sim = sim
    this.spread = 0
    this.status = STATUS_HEALTHY
    this.testDay = 0
    this.tokens = []
  }

  appInstalled() {
    return (this.attrs & PERSON_APP_INSTALLED) !== 0
  }

  // NOTE(tav): We simplify the calculations and deposit the tokens in just the
  // current daily account.
  deposit(from: number, depth: number, people: Person[]) {
    if (this.status === STATUS_DEAD) {
      return
    }
    this.tokens[this.tokens.length - 1][depth] += 1
    if (depth === 2) {
      return
    }
    depth++
    for (let i = 0; i < this.contacts.length; i++) {
      const contacts = this.contacts[i]
      for (let j = 0; j < contacts.length; j++) {
        const id = contacts[j]
        if (id === from) {
          continue
        }
        people[id].deposit(this.id, depth, people)
      }
    }
  }

  infect(today: number, gen: number) {
    if ((this.status & STATUS_INFECTED) !== 0) {
      return false
    }
    if ((this.status & STATUS_IMMUNE) !== 0) {
      return false
    }
    if (this.status === STATUS_DEAD) {
      return false
    }
    const sim = this.sim
    this.gen = gen
    this.infectedDay = sim.day
    this.infectionEndDay =
      sim.day +
      sim.cfg.preInfectiousDays +
      sim.cfg.preSymptomaticInfectiousDays +
      sim.cfg.illness.sample(sim.rng)
    this.immunityEndDay =
      this.infectionEndDay + sim.cfg.immunity.sample(sim.rng)
    this.status &= ~STATUS_HEALTHY
    this.status &= ~STATUS_RECOVERED
    this.status |= STATUS_INFECTED
    return true
  }

  infected() {
    return (this.status & STATUS_INFECTED) !== 0
  }

  installSafetyScore(day: number) {
    this.attrs |= PERSON_APP_INSTALLED
    this.installDate = day
    this.tokens.push([0, 0, 0])
  }

  isolate(end: number) {
    if (this.status === STATUS_DEAD) {
      return
    }
    this.isolationEndDay = end
    this.status |= STATUS_ISOLATED
  }

  symptomatic() {
    return (this.attrs & PERSON_SYMPTOMATIC) !== 0
  }
}

// Derived from:
// https://stackoverflow.com/questions/1241555/algorithm-to-generate-poisson-and-binomial-random-numbers
class PoissonDistribution {
  limit: number
  max: number
  min: number

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

interface Computed {
  dailyForeign: number
  dailyTests: number
  inactivityPenalty: number
  installForeign: number
  installOwn: number
  meanContacts: number
  traceDays: number
}

class Simulation {
  cfg: Config
  clusters: Cluster[]
  computed: Computed
  day: number
  graph: Graph
  households: Household[]
  installBase: number
  people: Person[]
  period: number
  presentNow: number[][]
  presentPrev: number[][]
  privateClusters: number[]
  publicClusters: number[]
  recentInfections: number[]
  rng: RNG
  rngApp: RNG
  rngForeign: RNG
  testQueue: number[]
  viz: Visualisation

  constructor(cfg: Config) {
    this.cfg = cfg
    this.recentInfections = []
    this.testQueue = []
  }

  init() {
    const cfg = this.cfg
    const rng = new RNG(`init`)
    // Generate people with custom attributes.
    const people: Person[] = []
    let installBase = 0
    let personID = 0
    for (let i = 0; i < cfg.population; i++) {
      let attrs = 0
      if (rng.next() <= cfg.appInstalled) {
        attrs |= PERSON_APP_INSTALLED
        installBase++
      }
      if (rng.next() <= cfg.symptomatic) {
        attrs |= PERSON_SYMPTOMATIC
      }
      const person = new Person(attrs, personID++, this)
      people.push(person)
    }
    this.installBase = installBase / cfg.population
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
        members,
        x: 0,
        y: 0,
      }
      households.push(house)
      houseID++
    }
    this.households = households
    // Generate clusters and allocate a primary cluster for everyone.
    const clusters: Cluster[] = []
    const presentNow: number[][] = []
    const presentPrev: number[][] = []
    const privateClusters: number[] = []
    const publicClusters: number[] = []
    let clusterID = 0
    let clusterPeople = people.slice(0)
    shuffle(clusterPeople, rng)
    i = 0
    while (i < cfg.population) {
      const members: number[] = []
      const size = cfg.clusterSize.sample(rng)
      for (let j = 0; j < size; j++) {
        const person = clusterPeople[i++]
        members.push(person.id)
        person.clusters.push(clusterID)
        if (i === cfg.population) {
          break
        }
      }
      let attrs = 0
      if (rng.next() <= cfg.gatekeptClusters) {
        attrs |= CLUSTER_GATEKEPT
      }
      if (rng.next() <= cfg.publicClusters) {
        attrs |= CLUSTER_PUBLIC
        publicClusters.push(clusterID)
      } else {
        privateClusters.push(clusterID)
      }
      const cluster: Cluster = {
        attrs,
        members,
        x: 0,
        y: 0,
      }
      clusterID++
      clusters.push(cluster)
      presentNow.push([])
      presentPrev.push([])
    }
    this.clusters = clusters
    this.presentNow = presentNow
    this.presentPrev = presentPrev
    this.privateClusters = privateClusters
    this.publicClusters = publicClusters
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
    // Derive computed values from config parameters.
    let traceDays = 0
    if (cfg.traceMethod === TRACE_APPLE_GOOGLE) {
      traceDays = 14
    } else if (cfg.traceMethod === TRACE_SAFETYSCORE) {
      traceDays =
        cfg.preInfectiousDays +
        cfg.preSymptomaticInfectiousDays +
        Math.round(getMean(cfg.illness)) +
        1
    }
    const meanContacts =
      getMean(cfg.clusterCount) * getMean(cfg.clusterSize) +
      getMean(cfg.groupSize) *
        CLUSTER_PERIODS *
        traceDays *
        cfg.foreignClusterVisit
    this.computed = {
      dailyForeign: cfg.foreignImports / cfg.days,
      dailyTests: Math.round(cfg.dailyTestCapacity * cfg.population),
      inactivityPenalty: 100 / traceDays,
      installForeign: cfg.installForeign / cfg.days,
      installOwn: cfg.installOwn / cfg.days,
      meanContacts,
      traceDays,
    }
    // Create graph and visualisation.
    if (IN_BROWSER) {
      this.graph = new Graph(cfg)
      this.viz = new Visualisation(this)
      currentGraph = this.graph
      currentViz = this.viz
    }
    this.rng = new RNG(`base-${randSuffix}`)
    this.rngApp = new RNG(`app-${randSuffix}`)
    this.rngForeign = new RNG(`foreign-${randSuffix}`)
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
    }
    for (let i = 0; i < CLUSTER_PERIODS; i++) {
      this.nextPeriod()
    }
    this.queueNext()
  }

  nextDay() {
    this.day++
    const cfg = this.cfg
    const computed = this.computed
    const day = this.day
    const isolationEnd = day + cfg.isolationDays
    const people = this.people
    const rng = this.rng
    const rngApp = this.rngApp
    const rngForeign = this.rngForeign
    for (let i = 0; i < cfg.population; i++) {
      const person = people[i]
      // Update the status of infected people.
      if (person.infected()) {
        if (day === person.infectedDay + cfg.preInfectiousDays) {
          // Handle the day the person might become symptomatic.
          person.status |= STATUS_CONTAGIOUS
          if (person.symptomatic()) {
            person.isolate(isolationEnd)
            if (person.testDay === 0 && rng.next() <= cfg.testing) {
              person.testDay = day + cfg.testDelay.sample(rng)
            }
          }
        } else if (day === person.infectionEndDay) {
          // Handle the end of the infection.
          if (rng.next() <= cfg.fatalityRisk) {
            person.status = STATUS_DEAD
          } else {
            person.status &= ~STATUS_CONTAGIOUS
            person.status &= ~STATUS_INFECTED
            person.status |= STATUS_IMMUNE | STATUS_RECOVERED
          }
        }
      } else if (rngForeign.next() <= computed.dailyForeign) {
        // Infect a person from a foreign imported case.
        person.infect(day, 0)
      }
      if (person.status === STATUS_DEAD) {
        continue
      }
      // If the person wants to be tested, then add them to the test queue.
      if (day === person.testDay) {
        person.testDay = -1
        this.testQueue.push(person.id)
      }
      // Strip the individual of immunity once it ends.
      if (
        (person.status & STATUS_IMMUNE) !== 0 &&
        day === person.immunityEndDay
      ) {
        person.status &= ~STATUS_IMMUNE
      }
      // Remove the individual from isolation once it ends.
      if (
        (person.status & STATUS_ISOLATED) !== 0 &&
        day === person.isolationEndDay
      ) {
        person.isolationEndDay = 0
        person.status &= ~STATUS_ISOLATED
      }
      // If the individual was prompted to consider the app, see if they'll
      // install it.
      if ((person.attrs & PERSON_APP_OWN_CLUSTER) !== 0) {
        if (rngApp.next() <= computed.installOwn) {
          person.attrs &= ~PERSON_APP_OWN_CLUSTER
          person.installSafetyScore(day)
        }
      } else if ((person.attrs & PERSON_APP_FOREIGN_CLUSTER) !== 0) {
        if (rngApp.next() <= computed.installForeign) {
          person.attrs &= ~PERSON_APP_FOREIGN_CLUSTER
          person.installSafetyScore(day)
        }
      }
    }
    const queue = this.testQueue
    if (cfg.traceMethod === TRACE_APPLE_GOOGLE) {
      // Follow the Apple/Google Exposure Notification method where contacts of
      // infected individuals are notified.
      const seen = new Set()
      for (let i = 0; i < computed.dailyTests && queue.length > 0; i++) {
        const id = queue.shift() as number
        const person = people[id]
        if (person.status === STATUS_DEAD) {
          continue
        }
        if (person.infected()) {
          // Place infected individuals into isolation.
          person.isolate(isolationEnd)
          // Notify their contacts.
          if (person.appInstalled()) {
            for (let j = 0; j < person.contacts.length; j++) {
              const contacts = person.contacts[j]
              for (let k = 0; k < contacts.length; k++) {
                const id = contacts[k]
                if (seen.has(id)) {
                  continue
                }
                const contact = people[id]
                // Prompt the contact to get tested.
                if (contact.testDay === 0 && rngApp.next() <= cfg.testing) {
                  contact.testDay = day + cfg.testDelay.sample(rng)
                }
                // Prompt the contact to self-isolate.
                if (rngApp.next() <= cfg.selfIsolation) {
                  contact.isolate(isolationEnd)
                }
                seen.add(id)
              }
            }
          }
        } else if ((person.status & STATUS_ISOLATED) !== 0) {
          // If an individual had been notified and isolated, remove them from
          // isolation.
          person.isolationEndDay = 0
          person.status &= ~STATUS_ISOLATED
        }
        person.testDay = 0
      }
      // Remove old contacts and re-use cleared Array for upcoming contacts.
      for (let i = 0; i < cfg.population; i++) {
        const person = people[i]
        if (person.status !== STATUS_DEAD && person.appInstalled()) {
          if (person.contacts.length === computed.traceDays) {
            const first = person.contacts.shift() as number[]
            first.length = 0
            person.contacts.push(first)
          } else {
            person.contacts.push([])
          }
        }
      }
    } else if (cfg.traceMethod === TRACE_SAFETYSCORE) {
      const {inactivityPenalty, meanContacts, traceDays} = computed
      // Handle test results.
      for (let i = 0; i < computed.dailyTests && queue.length > 0; i++) {
        const id = queue.shift() as number
        const person = people[id]
        if (person.status === STATUS_DEAD) {
          continue
        }
        if (person.infected()) {
          person.isolate(isolationEnd)
          if (person.appInstalled()) {
            person.deposit(-1, 0, people)
          }
        } else if ((person.status & STATUS_ISOLATED) !== 0) {
          person.isolationEndDay = 0
          person.status &= ~STATUS_ISOLATED
        }
        person.testDay = 0
      }
      // Amplify second-degree weighting based on app penetration and test
      // capacity.
      const contactLikelihood = this.installBase * this.installBase
      const secondDegree = Math.min(
        10 / (contactLikelihood * contactLikelihood * cfg.dailyTestCapacity),
        50
      )
      console.log(secondDegree)
      // const secondDegree = cfg.infectionRisk * (1.1 - this.installBase) * 10
      for (let i = 0; i < cfg.population; i++) {
        const person = people[i]
        if (person.status === STATUS_DEAD || !person.appInstalled()) {
          continue
        }
        // Update the SafetyScore of everyone who has the app installed.
        let score = 100
        for (let j = 0; j < person.tokens.length; j++) {
          const account = person.tokens[j]
          score -= account[0] * 100
          score -= account[1] * 50
          score -= account[2] * secondDegree
        }
        const active = Math.max(0, day - person.installDate)
        if (active < traceDays) {
          score -= (traceDays - active) * inactivityPenalty
        }
        person.score = score
        let recentFirst = false
        if (person.tokens.length > 0) {
          recentFirst = person.tokens[person.tokens.length - 1][1] > 0
        }
        // Prompt the individual to isolate and get tested if they received a
        // recent first-degree deposit
        if (recentFirst && score <= cfg.isolationThreshold) {
          if (rngApp.next() <= cfg.selfIsolation) {
            person.isolate(isolationEnd)
          }
          if (person.testDay === 0 && rngApp.next() <= cfg.testing) {
            person.testDay = day + cfg.testDelay.sample(rng)
          }
        }
        // Remove old contacts.
        if (person.contacts.length === computed.traceDays) {
          const first = person.contacts.shift() as number[]
          first.length = 0
          person.contacts.push(first)
        } else {
          person.contacts.push([])
        }
        // Remove old daily accounts.
        if (person.tokens.length === computed.traceDays) {
          const first = person.tokens.shift() as number[]
          first[0] = 0
          first[1] = 0
          first[2] = 0
          person.tokens.push(first)
        } else {
          person.tokens.push([0, 0, 0])
        }
      }
    }
    // Generate the daily stats.
    const stats = {
      dead: 0,
      healthy: 0,
      immune: 0,
      infected: 0,
      installed: 0,
      isolated: 0,
      recovered: 0,
    }
    for (let i = 0; i < cfg.population; i++) {
      const person = people[i]
      const status = person.status
      if ((status & STATUS_HEALTHY) !== 0) {
        stats.healthy++
      } else if ((status & STATUS_INFECTED) !== 0) {
        stats.infected++
      } else if ((status & STATUS_RECOVERED) !== 0) {
        stats.recovered++
      } else if ((status & STATUS_DEAD) !== 0) {
        stats.dead++
      }
      if ((status & STATUS_IMMUNE) !== 0) {
        stats.immune++
      }
      if ((status & STATUS_ISOLATED) !== 0) {
        stats.isolated++
      }
      if ((person.attrs & PERSON_APP_INSTALLED) !== 0) {
        stats.installed++
      }
    }
    this.installBase = stats.installed / cfg.population
    // Update output.
    if (IN_BROWSER) {
      this.viz.draw(people)
      this.graph.update(stats)
    } else {
      if (cfg.output === "console") {
        console.log(stats)
      } else {
        result.push(stats)
      }
    }
  }

  nextPeriod() {
    this.period++
    if (this.period === CLUSTER_PERIODS) {
      this.period = 0
    }
    const cfg = this.cfg
    const clusters = this.clusters
    const traceMethod = cfg.traceMethod
    const people = this.people
    const rng = this.rng
    const rngApp = this.rngApp
    const present = this.presentNow
    for (let i = 0; i < cfg.population; i++) {
      const person = people[i]
      // Skip dead people.
      if (person.status === STATUS_DEAD) {
        continue
      }
      // If the person is self-isolating, only consider them if they temporarily
      // break isolation for some reason.
      if ((person.status & STATUS_ISOLATED) !== 0) {
        if (rng.next() <= cfg.isolation) {
          continue
        }
      }
      // Select a cluster for the person to visit.
      let clusterID
      let foreign = true
      if (rng.next() <= cfg.foreignClusterVisit) {
        if (rng.next() <= cfg.publicClusterVisit) {
          clusterID = Math.floor(rng.next() * this.publicClusters.length)
        } else {
          clusterID = Math.floor(rng.next() * this.privateClusters.length)
        }
      } else {
        clusterID = Math.floor(rng.next() * person.clusters.length)
        foreign = false
      }
      if (traceMethod === TRACE_SAFETYSCORE) {
        const cluster = clusters[clusterID]
        if ((cluster.attrs & CLUSTER_GATEKEPT) === 0) {
          // If the user has the app and the cluster isn't gate-kept, see if
          // they'll consider visiting it.
          if ((person.attrs & PERSON_APP_INSTALLED) !== 0) {
            if (!(rngApp.next() <= cfg.exposedVisit)) {
              continue
            }
          }
        } else {
          // For a gate-kept cluster, if the user doesn't have the app
          // installed, see if they will consider installing it.
          if ((person.attrs & PERSON_APP_INSTALLED) === 0) {
            if (foreign) {
              person.attrs |= PERSON_APP_FOREIGN_CLUSTER
            } else {
              person.attrs |= PERSON_APP_OWN_CLUSTER
            }
            continue
          }
          // If they do have the app, check if their score meets the necessary
          // level.
          if (person.score <= cfg.gatekeptThreshold) {
            continue
          }
        }
      }
      present[clusterID].push(person.id)
    }
    const day = this.day
    const group = []
    const healthy = []
    const infected = []
    const infectionRisk = cfg.infectionRisk
    const installed = []
    const trace = cfg.traceMethod !== TRACE_NONE
    for (let i = 0; i < present.length; i++) {
      const visitors = present[i]
      while (visitors.length > 0) {
        // Segment the visitors into groups.
        let size = cfg.groupSize.sample(rng)
        group.length = 0
        healthy.length = 0
        infected.length = 0
        installed.length = 0
        while (size > 0 && visitors.length > 0) {
          group.push(visitors.pop())
          size--
        }
        shuffle(group, rng)
        // Identify the healthy/recovered, the infected, and those with apps.
        for (let j = 0; j < group.length; j++) {
          const person = people[group[j]!]
          if ((person.status & STATUS_INFECTED) !== 0) {
            infected.push(person)
          } else if ((person.status & STATUS_IMMUNE) === 0) {
            healthy.push(person)
          }
          if (trace && (person.attrs & PERSON_APP_INSTALLED) !== 0) {
            installed.push(person)
          }
        }
        // If there are any infected, try and infect the healthy.
        if (infected.length > 0 && healthy.length > 0) {
          for (let j = 0; j < healthy.length; j++) {
            for (let k = 0; k < infected.length; k++) {
              if (rng.next() <= infectionRisk) {
                const from = infected[k]
                healthy[j].infect(day, from.gen + 1)
                from.spread += 1
                break
              }
            }
          }
        }
        // Establish contacts between those who have app installed.
        if (trace) {
          for (let j = 0; j < installed.length; j++) {
            const contacts = installed[j].contacts
            const cur = contacts[contacts.length - 1]
            for (let k = 0; k < installed.length; k++) {
              if (j === k) {
                continue
              }
              cur.push(installed[k].id)
            }
          }
        }
      }
    }
  }

  queueNext() {
    if (IN_BROWSER) {
      if (configDisplayed) {
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
      } else if ((status & STATUS_RECOVERED) !== 0) {
        ctx.fillStyle = VIZ_COLOUR_RECOVERED
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
  max: number
  min: number
  zetan: number

  constructor(min: number, max: number) {
    this.items = max - min + 1
    this.max = max
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

function displayConfig() {
  if (configDisplayed) {
    return
  }
  configDisplayed = true
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
  const elemWidth = Math.max(1, Math.floor(graph.width / graph.cfg.days))
  const width = elemWidth * graph.cfg.days
  const canvas = document.createElement("canvas") as HTMLCanvasElement
  const ctx = canvas.getContext("2d")!
  const src = graph.ctx.getImageData(0, 0, width, graph.height)
  canvas.height = graph.height
  canvas.width = width
  ctx.putImageData(src, 0, 0)
  const data = canvas.toDataURL("image/png", 1)
  const link = document.createElement("a")
  link.href = data.replace("image/png", "image/octet-stream")
  let filename = "simulation"
  switch (graph.cfg.traceMethod) {
    case TRACE_NONE:
      filename += "-zero-interventions"
      break
    case TRACE_APPLE_GOOGLE:
      filename += "-apple-google-api"
      break
    case TRACE_SAFETYSCORE:
      filename += "-safetyscore"
      break
  }
  filename += `-${Date.now()}.png`
  link.download = filename
  link.click()
}

function genSVG(colors: string) {
  const out = ["<svg>"]
  out.push("</svg>")
  console.log(out.join(""))
}

function getCmdOpt(flag: string, fallback: string) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) {
    return fallback
  }
  return process.argv[idx + 1]
}

function getConfig(): Config {
  if (!currentConfig) {
    currentConfig = {
      ...defaultConfig(),
      output: "console",
      traceMethod: TRACE_NONE,
    }
  }
  return currentConfig
}

function getMean(dist: Distribution) {
  const rng = new RNG("mean")
  let val = 0
  for (let i = 0; i < 10000; i++) {
    val += dist.sample(rng)
  }
  return val / 10000
}

function getTraceMethod(s: string) {
  let traceMethod
  switch (s) {
    case "apple-google":
      traceMethod = TRACE_APPLE_GOOGLE
      break
    case "none":
      traceMethod = TRACE_NONE
      break
    case "safetyscore":
      traceMethod = TRACE_SAFETYSCORE
      break
    default:
      throw `Unknown trace method: ${s}`
  }
  return traceMethod
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
  if (configDisplayed) {
    if (e.code === "Escape") {
      handleOverlayClick()
    } else if (e.ctrlKey && e.code === "Enter") {
      updateConfig()
    }
    return
  }
  if (e.code === "KeyE") {
    displayConfig()
    return
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
    return
  }
  if (e.code === "KeyR") {
    randSuffix = Date.now()
    triggerSimulation()
    return
  }
}

function handleOverlayClick() {
  if (!configDisplayed) {
    return
  }
  configDisplayed = false
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
      cancelAnimationFrame(handle as number)
    } else {
      clearTimeout(handle as ReturnType<typeof setTimeout>)
    }
  }
  const sim = new Simulation(cfg)
  currentSim = sim
  sim.init()
  sim.run()
}

function scrollEditor() {
  $mirror.scrollTop = $config.scrollTop
}

// Adapted from
// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array: Array<any>, rng: RNG) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
}

function syncEditor() {
  if (!configDisplayed) {
    return
  }
  updateMirror($config.value)
}

function triggerSimulation() {
  const $options = $("options") as HTMLSelectElement
  const traceMethod = getTraceMethod(
    $options.options[$options.selectedIndex].value
  )
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
  if (!configDisplayed) {
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
  configDisplayed = false
  $("overlay").style.display = "none"
  triggerSimulation()
}

function updateMirror(src: string) {
  const code = Prism.highlight(src, Prism.languages.javascript)
  $mirror.innerHTML = code
}

function validateConfig(cfg: Config) {
  const v = new ConfigValidator(cfg)
  v.validateBoolean(["sampleVisualisation"])
  v.validateDistribution([
    "clusterCount",
    "clusterSize",
    "groupSize",
    "household",
    "illness",
    "immunity",
    "testDelay",
  ])
  v.validateNumber([
    "days",
    "isolationDays",
    "population",
    "preInfectiousDays",
    "preSymptomaticInfectiousDays",
  ])
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
  ])
  v.validateScore(["gatekeptThreshold", "isolationThreshold"])
  v.checkFields()
  return cfg
}

function main() {
  if (IN_BROWSER) {
    document.addEventListener("keyup", handleKeyboard)
    $("config").addEventListener("keyup", syncEditor)
    $("config").addEventListener("scroll", scrollEditor)
    $("download").addEventListener("click", downloadImage)
    $("edit-config").addEventListener("click", displayConfig)
    $("inlay").addEventListener("click", handleInlayClick)
    $("options").addEventListener("change", triggerSimulation)
    $("overlay").addEventListener("click", handleOverlayClick)
    $("update-config").addEventListener("click", updateConfig)
    triggerSimulation()
  } else {
    const colors = getCmdOpt("--colors", "default")
    const output = getCmdOpt("--output", "console")
    const traceMethod = getTraceMethod(getCmdOpt("--method", "none"))
    runSimulation({...getConfig(), output, traceMethod})
    if (output === "svg") {
      genSVG(colors)
    }
  }
}

if (IN_BROWSER) {
  window.addEventListener("load", main)
  window.addEventListener("resize", handleResize)
} else {
  main()
}
