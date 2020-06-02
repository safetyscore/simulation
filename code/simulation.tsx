// See https://github.com/safetyscore/simulation for the source repo.

// Determine host environment.
const IN_BROWSER = typeof self === "object"
const IN_WORKER = typeof importScripts === "function"

// Attribute values for clusters.
const CLUSTER_GATEKEPT = 1
const CLUSTER_PUBLIC = 2

// Time spent in clusters during a day.
const CLUSTER_PERIODS = 8

// User interface colours.
const COLOUR_DEAD = "#444444"
const COLOUR_HEALTHY = "#8bb4b8"
const COLOUR_INFECTED = "#ff3945"
const COLOUR_RECOVERED = "#009d51"

// Intervention methods.
const METHOD_APPLE_GOOGLE = 1
const METHOD_FREE_MOVEMENT = 2
const METHOD_LOCKDOWN = 3
const METHOD_SAFETYSCORE = 4

// Attribute values for people.
const PERSON_APP_FOREIGN_CLUSTER = 1
const PERSON_APP_INSTALLED = 2
const PERSON_APP_OWN_CLUSTER = 4
const PERSON_KEY_WORKER = 8
const PERSON_SYMPTOMATIC = 16

// Status values.
const STATUS_HEALTHY = 1
const STATUS_INFECTED = 2
const STATUS_CONTAGIOUS = 4
const STATUS_RECOVERED = 8
const STATUS_IMMUNE = 16
const STATUS_DEAD = 32
const STATUS_ISOLATED = 64
const STATUS_QUARANTINED = 128

// let currentConfig: Config
// let currentConfigDefinition: string
// let currentGraph: Graph
// let currentSim: Simulation
// let result: Stats[] = []
// let handle: ReturnType<typeof setTimeout> | number

const methods = [
  METHOD_FREE_MOVEMENT,
  METHOD_APPLE_GOOGLE,
  METHOD_SAFETYSCORE,
  METHOD_LOCKDOWN,
]

let configDisplayed = false
let ctrl: Controller
let parentPort: MessagePort & NodeEventEmitter

let $config: HTMLTextAreaElement
let $mirror: HTMLPreElement

declare namespace JSX {
  interface IntrinsicElements {
    canvas: ElemProps
    div: ElemProps
    img: ElemProps
    span: ElemProps
  }
}

declare namespace Prism {
  function highlight(code: string, lang: string): string
  let languages: Record<string, string>
}

interface Cluster {
  attrs: number
  members: number[]
}

interface Computed {
  dailyForeign: number
  dailyTests: number
  inactivityPenalty: number
  infectiousDays: number
  installForeign: number
  installOwn: number
  meanContacts: number
  traceDays: number
}

interface Config {
  appleGoogleInstalled: number
  clusterCount: Distribution
  clusterSize: Distribution
  dailyTestCapacity: number
  days: number
  exposedVisit: number
  fatalityRisk: number
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
  installOwnHousehold: number
  isolateHousehold: boolean
  isolationDays: number
  isolationEffectiveness: number
  isolationLikelihood: number
  isolationLockdown: number
  isolationThreshold: number
  keyWorkers: number
  lockdownEnd: number
  lockdownEndWindow: number
  lockdownStart: number
  outputFormat: "csv" | "png" | "svg"
  population: number
  preInfectiousDays: number
  preSymptomaticInfectiousDays: number
  publicClusters: number
  runAppleGoogle: boolean
  runFreeMovement: boolean
  runLockdown: boolean
  runSafetyScore: boolean
  safetyScoreInstalled: number
  secondDegreeWeight: number
  selfAttestation: number
  symptomatic: number
  testDelay: Distribution
  testKeyWorker: number
  testKeyWorkers: boolean
  testing: number
  vaccinated: number
  visitForeignCluster: number
  visitPublicCluster: number
}

interface Distribution {
  sample(rng: RNG): number
  max: number
}

interface ElemProps {
  onclick?: (ev: Event) => void
  alt?: string
  height?: string
  class?: string
  src?: string
  width?: string
}

interface NodeEventEmitter {
  on(eventName: string, listener: any): NodeEventEmitter
}

interface ProgressUpdate {
  day: number
  id: number
  type: "progress"
}

interface ResultsUpdate {
  results: Stats[]
  id: number
  type: "results"
}

interface WorkerRequest {
  cfg: string
  id: number
  method: number
  rand: number
}

interface Stats {
  dead: number
  healthy: number
  immune: number
  infected: number
  installed: number
  isolated: number
  lockdown: boolean
  r: number
  recovered: number
}

type WorkerResponse = ProgressUpdate | ResultsUpdate

class AbstractedWorker {
  worker: Worker & NodeEventEmitter

  constructor(src: string) {
    if (IN_BROWSER) {
      this.worker = new Worker(src) as Worker & NodeEventEmitter
    } else {
      const {Worker} = require("worker_threads")
      this.worker = new Worker(src)
    }
  }

  onMessage(handler: (req: WorkerResponse) => void) {
    if (IN_BROWSER) {
      this.worker.onmessage = (e) => {
        handler(e.data)
      }
    } else {
      this.worker.on("message", handler)
    }
  }

  postMessage(req: WorkerRequest) {
    this.worker.postMessage(req)
  }

  terminate() {
    this.worker.terminate()
  }
}

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

  validateStringValue(field: string, values: string[]) {
    this.seen.add(field)
    const val = this.cfg[field]
    if (val === undefined) {
      throw `The value for "${field}" cannot be undefined`
    }
    if (!includes(values, val)) {
      throw `Invalid value for "${field}"`
    }
  }
}

class Controller {
  cfg: Config
  definition: string
  id: number
  rand: number
  sims: Record<number, Simulation>
  simList: Simulation[]
  $main: HTMLElement

  constructor() {
    this.cfg = defaultConfig()
    this.definition = defaultConfigDefinition()
    this.id = 1
    this.rand = 1591117461038 // 1591106930265
  }

  initBrowser() {
    this.$main = $("main")
    this.initSims(true)
    this.run()
  }

  initNodeJS(method: number) {
    const cfg = this.cfg
    cfg.runAppleGoogle = false
    cfg.runFreeMovement = false
    cfg.runLockdown = false
    cfg.runSafetyScore = false
    if (method === METHOD_APPLE_GOOGLE) {
      cfg.runAppleGoogle = true
    } else if (method === METHOD_FREE_MOVEMENT) {
      cfg.runFreeMovement = true
    } else if (method === METHOD_LOCKDOWN) {
      cfg.runLockdown = true
    } else if (method === METHOD_SAFETYSCORE) {
      cfg.runSafetyScore = true
    }
    this.initSims(false)
    this.run()
  }

  initSims(setupUI: boolean) {
    this.simList = []
    this.sims = {}
    for (let i = 0; i < methods.length; i++) {
      const method = methods[i]
      const sim = new Simulation(this, method)
      if (setupUI) {
        this.$main.appendChild(sim.setupUI())
      }
      this.simList.push(sim)
      this.sims[method] = sim
    }
  }

  randomise() {
    this.id++
    this.rand = Date.now()
    console.log(`Random: ${this.rand}`)
    this.run()
  }

  resume() {
    for (let i = 0; i < this.simList.length; i++) {
      this.simList[i].render()
    }
  }

  run() {
    const cfg = this.cfg
    if (cfg.runAppleGoogle) {
      this.sims[METHOD_APPLE_GOOGLE].show()
    } else {
      this.sims[METHOD_APPLE_GOOGLE].hide()
    }
    if (cfg.runFreeMovement) {
      this.sims[METHOD_FREE_MOVEMENT].show()
    } else {
      this.sims[METHOD_FREE_MOVEMENT].hide()
    }
    if (cfg.runLockdown) {
      this.sims[METHOD_LOCKDOWN].show()
    } else {
      this.sims[METHOD_LOCKDOWN].hide()
    }
    if (cfg.runSafetyScore) {
      this.sims[METHOD_SAFETYSCORE].show()
    } else {
      this.sims[METHOD_SAFETYSCORE].hide()
    }
    this.setDimensions()
    for (let i = 0; i < this.simList.length; i++) {
      const sim = this.simList[i]
      if (!sim.hidden) {
        sim.run(this.definition, this.id, this.rand)
      }
    }
  }

  runNew(cfg: Config, definition: string) {
    this.cfg = cfg
    this.definition = definition
    this.id++
    this.run()
  }

  setDimensions() {
    for (let i = 0; i < this.simList.length; i++) {
      this.simList[i].setDimensions()
    }
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
      $("r"),
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
    $[6].innerText = stats.r.toFixed(2).toString()
    this.draw(day)
  }
}

class Model {
  cfg: Config
  clusters: Cluster[]
  computed: Computed
  day: number
  graph: Graph
  handle: ReturnType<typeof setTimeout>
  households: number[][]
  id: number
  installBase: number
  lockdown: boolean
  lockdownEase: number
  method: number
  people: Person[]
  period: number
  presentNow: number[][]
  presentPrev: number[][]
  privateClusters: number[]
  publicClusters: number[]
  rand: number
  recentInfections: number[][]
  results: Stats[]
  rng: RNG
  rngApp: RNG
  rngForeign: RNG
  spread: number[][]
  testQueue: number[]

  handleMessage(req: WorkerRequest) {
    this.cfg = eval(`(${req.cfg})`)
    this.id = req.id
    this.method = req.method
    this.rand = req.rand
    if (this.handle) {
      clearTimeout(this.handle)
    }
    this.init()
    this.run()
  }

  init() {
    const cfg = this.cfg
    const immunityEnd = cfg.days + 1
    const rand = this.rand
    const rng = new RNG(`init-${rand}`)
    // Generate people with custom attributes.
    const people: Person[] = []
    let appInstalled = 0
    let installBase = 0
    let personID = 0
    if (this.method === METHOD_APPLE_GOOGLE) {
      appInstalled = cfg.appleGoogleInstalled
    } else if (this.method === METHOD_SAFETYSCORE) {
      appInstalled = cfg.safetyScoreInstalled
    }
    for (let i = 0; i < cfg.population; i++) {
      let attrs = 0
      if (rng.next() <= appInstalled) {
        attrs |= PERSON_APP_INSTALLED
        installBase++
      }
      if (rng.next() <= cfg.keyWorkers) {
        attrs |= PERSON_KEY_WORKER
        installBase++
      }
      if (rng.next() <= cfg.symptomatic) {
        attrs |= PERSON_SYMPTOMATIC
      }
      const person = new Person(attrs, personID++, this)
      if (rng.next() <= cfg.vaccinated) {
        person.immunityEndDay = immunityEnd
        person.status |= STATUS_IMMUNE
      }
      people.push(person)
    }
    this.installBase = installBase / cfg.population
    this.people = people
    // Generate households and allocate people to households.
    const households: number[][] = []
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
      households.push(members)
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
    if (this.method === METHOD_APPLE_GOOGLE) {
      traceDays = 14
    } else if (this.method === METHOD_SAFETYSCORE) {
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
        cfg.visitForeignCluster
    this.computed = {
      dailyForeign: cfg.foreignImports / cfg.population,
      dailyTests: Math.round(cfg.dailyTestCapacity * cfg.population),
      inactivityPenalty: 100 / traceDays,
      infectiousDays:
        cfg.preSymptomaticInfectiousDays + Math.round(getMean(cfg.illness)),
      installForeign: cfg.installForeign / cfg.days,
      installOwn: cfg.installOwn / cfg.days,
      meanContacts,
      traceDays,
    }
    if (this.method === METHOD_SAFETYSCORE) {
      const convert = new Set()
      for (i = 0; i < cfg.population; i++) {
        if (rng.next() <= 0.333333) {

        }
      }
    }
    // Create graph and visualisation.
    this.day = 0
    this.period = 0
    this.recentInfections = []
    this.results = []
    this.rng = new RNG(`base-${rand}`)
    this.rngApp = new RNG(`app-${rand}`)
    this.rngForeign = new RNG(`foreign-${rand}`)
    this.spread = []
    this.testQueue = []
  }

  nextDay() {
    this.day++
    const cfg = this.cfg
    const computed = this.computed
    const day = this.day
    const infectionRisk = cfg.infectionRisk
    const isolationEnd = day + cfg.isolationDays
    const people = this.people
    const rng = this.rng
    const rngApp = this.rngApp
    const rngForeign = this.rngForeign
    let infected = 0
    let spreadBy = 0
    let spreadTotal = 0
    for (let i = 0; i < cfg.population; i++) {
      const person = people[i]
      // Update the status of infected people.
      if (person.infected()) {
        infected++
        if (day === person.infectedDay + cfg.preInfectiousDays) {
          // Handle the day the person might become symptomatic.
          person.status |= STATUS_CONTAGIOUS
          if (person.symptomatic()) {
            person.isolate(isolationEnd)
            if (person.testDay === 0 && rng.next() <= cfg.testing) {
              person.testDay = day + cfg.testDelay.sample(rng)
            }
            if (
              this.method === METHOD_SAFETYSCORE &&
              person.appInstalled() &&
              rng.next() <= cfg.selfAttestation
            ) {
              person.deposit(-1, 0, people, 3)
            }
            if (cfg.isolateHousehold) {
              for (let j = 0; j < person.householdContacts.length; j++) {
                people[person.householdContacts[j]].isolate(isolationEnd)
              }
            }
          }
        } else if (day === person.infectionEndDay) {
          spreadBy++
          spreadTotal += person.spread
          // Handle the end of the infection.
          if (rng.next() <= cfg.fatalityRisk) {
            person.status = STATUS_DEAD
          } else {
            person.status &= ~STATUS_CONTAGIOUS
            person.status &= ~STATUS_INFECTED
            person.status |= STATUS_IMMUNE | STATUS_RECOVERED
          }
        }
        // If the person is contagious, try and infect any healthy members of
        // their household.
        if ((person.status & STATUS_CONTAGIOUS) !== 0) {
          for (let j = 0; j < person.householdContacts.length; j++) {
            const other = people[person.householdContacts[j]]
            if (
              (other.status & STATUS_INFECTED) === 0 &&
              (other.status & STATUS_IMMUNE) === 0
            ) {
              if (rng.next() <= infectionRisk) {
                other.infect(day, person.gen + 1)
                person.spread++
                break
              }
            }
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
          if (rngApp.next() <= cfg.installOwnHousehold) {
            for (let j = 0; j < person.householdContacts.length; j++) {
              const other = people[person.householdContacts[j]]
              other.installSafetyScore(day)
            }
          }
        }
      } else if ((person.attrs & PERSON_APP_FOREIGN_CLUSTER) !== 0) {
        if (rngApp.next() <= computed.installForeign) {
          person.attrs &= ~PERSON_APP_FOREIGN_CLUSTER
          person.installSafetyScore(day)
        }
      }
    }
    if (this.recentInfections.length === computed.infectiousDays) {
      const first = this.recentInfections.shift() as number[]
      first[0] = spreadTotal
      first[1] = spreadBy
      this.recentInfections.push(first)
    } else {
      this.recentInfections.push([spreadTotal, spreadBy])
    }
    const queue = this.testQueue
    if (this.method === METHOD_APPLE_GOOGLE) {
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
          if (cfg.isolateHousehold) {
            for (let j = 0; j < person.householdContacts.length; j++) {
              people[person.householdContacts[j]].isolate(isolationEnd)
            }
          }
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
                if (rngApp.next() <= cfg.isolationLikelihood) {
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
    } else if (this.method === METHOD_SAFETYSCORE) {
      const {inactivityPenalty, traceDays} = computed
      // Handle test results.
      for (let i = 0; i < computed.dailyTests && queue.length > 0; i++) {
        const id = queue.shift() as number
        const person = people[id]
        if (person.status === STATUS_DEAD) {
          continue
        }
        if (person.infected()) {
          person.isolate(isolationEnd)
          if (cfg.isolateHousehold) {
            for (let j = 0; j < person.householdContacts.length; j++) {
              people[person.householdContacts[j]].isolate(isolationEnd)
            }
          }
          if (person.appInstalled()) {
            person.deposit(-1, 0, people, 0)
          }
        } else {
          person.tokens.length = 0
          person.tokens.push([0, 0, 0, 0, 0, 0])
          if ((person.status & STATUS_ISOLATED) !== 0) {
            person.isolationEndDay = 0
            person.status &= ~STATUS_ISOLATED
          }
        }
        person.testDay = 0
      }
      // Amplify second-degree weighting based on app penetration and test
      // capacity.
      const contactLikelihood = this.installBase * this.installBase
      const secondDegree =
        cfg.secondDegreeWeight *
        Math.min(
          10 / (contactLikelihood * contactLikelihood * cfg.dailyTestCapacity),
          50
        )
      for (let i = 0; i < cfg.population; i++) {
        const person = people[i]
        if (person.status === STATUS_DEAD || !person.appInstalled()) {
          continue
        }
        // Update the SafetyScore of everyone who has the app installed.
        let score = 100
        let selfAttestations = 0
        for (let j = 0; j < person.tokens.length; j++) {
          const account = person.tokens[j]
          score -= account[0] * 100
          score -= account[1] * 50
          score -= account[2] * secondDegree
          selfAttestations += account[3] * 100
          selfAttestations += account[4] * 50
          selfAttestations += account[5] * secondDegree
        }
        // Only consider self-attestations if there are deposits that were
        // triggered by an official test.
        if (score < 100) {
          score -= selfAttestations
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
        // recent first-degree deposit triggered by an official test.
        if (recentFirst && score <= cfg.isolationThreshold) {
          if (rngApp.next() <= cfg.isolationLikelihood) {
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
          first[3] = 0
          first[4] = 0
          first[5] = 0
          person.tokens.push(first)
        } else {
          person.tokens.push([0, 0, 0, 0, 0, 0])
        }
      }
    } else {
      for (let i = 0; i < computed.dailyTests && queue.length > 0; i++) {
        const id = queue.shift() as number
        const person = people[id]
        if (person.status === STATUS_DEAD) {
          continue
        }
        if (person.infected()) {
          person.isolate(isolationEnd)
          if (cfg.isolateHousehold) {
            for (let j = 0; j < person.householdContacts.length; j++) {
              people[person.householdContacts[j]].isolate(isolationEnd)
            }
          }
        }
      }
      if (this.method === METHOD_LOCKDOWN) {
        if (this.lockdown) {
          if (infected < cfg.lockdownEnd) {
            this.lockdownEase++
            if (this.lockdownEase === cfg.lockdownEndWindow) {
              this.lockdown = false
            }
          } else {
            this.lockdownEase = 0
          }
        } else if (infected >= cfg.lockdownStart) {
          this.lockdown = true
        }
      }
      if (this.lockdown && cfg.testKeyWorkers) {
        // Test key workers.
        for (let i = 0; i < cfg.population; i++) {
          const person = people[i]
          if (
            (person.attrs & PERSON_KEY_WORKER) !== 0 &&
            person.testDay === 0 &&
            rng.next() <= cfg.testKeyWorker
          ) {
            person.testDay = day + cfg.testDelay.sample(rng)
          }
        }
      }
    }
    // Generate the daily stats.
    const lockdown = this.lockdown
    const stats: Stats = {
      dead: 0,
      healthy: 0,
      immune: 0,
      infected: 0,
      installed: 0,
      isolated: 0,
      lockdown,
      r: 0,
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
      if (lockdown) {
        if ((person.attrs & PERSON_KEY_WORKER) === 0) {
          stats.isolated++
        } else if ((status & STATUS_ISOLATED) !== 0) {
          stats.isolated++
        }
      } else {
        if ((status & STATUS_ISOLATED) !== 0) {
          stats.isolated++
        }
      }
      if ((person.attrs & PERSON_APP_INSTALLED) !== 0) {
        stats.installed++
      }
    }
    spreadTotal = 0
    spreadBy = 0
    for (let i = 0; i < this.recentInfections.length; i++) {
      const stat = this.recentInfections[i]
      spreadTotal += stat[0]
      spreadBy += stat[1]
    }
    if (spreadBy) {
      stats.r = spreadTotal / spreadBy
    }
    this.installBase = stats.installed / cfg.population
    // Update results.
    this.results.push(stats)
  }

  nextPeriod() {
    this.period++
    if (this.period === CLUSTER_PERIODS) {
      this.period = 0
    }
    const cfg = this.cfg
    const clusters = this.clusters
    const lockdown = this.lockdown
    const method = this.method
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
      if (lockdown) {
        // If they're not a key worker, see if they might temporarily break
        // isolation for some reason.
        if ((person.attrs & PERSON_KEY_WORKER) === 0) {
          if (rng.next() <= cfg.isolationLockdown) {
            continue
          }
        } else if ((person.status & STATUS_ISOLATED) !== 0) {
          if (rng.next() <= cfg.isolationLockdown) {
            continue
          }
        }
      } else {
        // If the person is self-isolating, only consider them if they temporarily
        // break isolation for some reason.
        if ((person.status & STATUS_ISOLATED) !== 0) {
          if (rng.next() <= cfg.isolationEffectiveness) {
            continue
          }
        }
      }
      // Select a cluster for the person to visit.
      let clusterID
      let foreign = true
      if (rng.next() <= cfg.visitForeignCluster) {
        if (rng.next() <= cfg.visitPublicCluster) {
          clusterID = Math.floor(rng.next() * this.publicClusters.length)
        } else {
          clusterID = Math.floor(rng.next() * this.privateClusters.length)
        }
      } else {
        clusterID = Math.floor(rng.next() * person.clusters.length)
        foreign = false
      }
      if (method === METHOD_SAFETYSCORE) {
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
    const contagious = []
    const day = this.day
    const group = []
    const healthy = []
    const infectionRisk = cfg.infectionRisk
    const installed = []
    const trace =
      this.method === METHOD_APPLE_GOOGLE || this.method === METHOD_SAFETYSCORE
    for (let i = 0; i < present.length; i++) {
      const visitors = present[i]
      while (visitors.length > 0) {
        // Segment the visitors into groups.
        let size = cfg.groupSize.sample(rng)
        contagious.length = 0
        group.length = 0
        healthy.length = 0
        installed.length = 0
        while (size > 0 && visitors.length > 0) {
          group.push(visitors.pop())
          size--
        }
        shuffle(group, rng)
        // Identify the healthy/recovered, the infected, and those with apps.
        for (let j = 0; j < group.length; j++) {
          const person = people[group[j]!]
          if ((person.status & STATUS_CONTAGIOUS) !== 0) {
            contagious.push(person)
          } else if (
            (person.status & STATUS_INFECTED) === 0 &&
            (person.status & STATUS_IMMUNE) === 0
          ) {
            healthy.push(person)
          }
          if (trace && (person.attrs & PERSON_APP_INSTALLED) !== 0) {
            installed.push(person)
          }
        }
        // If any are contagious, try and infect the healthy.
        if (contagious.length > 0 && healthy.length > 0) {
          for (let j = 0; j < healthy.length; j++) {
            for (let k = 0; k < contagious.length; k++) {
              if (rng.next() <= infectionRisk) {
                const from = contagious[k]
                healthy[j].infect(day, from.gen + 1)
                from.spread++
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

  run() {
    for (let i = 0; i < this.cfg.days; i++) {
      if (this.period === 0) {
        this.nextDay()
      }
      for (let j = 0; j < CLUSTER_PERIODS; j++) {
        this.nextPeriod()
      }
      if (this.day === this.cfg.days) {
        sendMessage({id: this.id, results: this.results, type: "results"})
      } else {
        sendMessage({day: this.day, id: this.id, type: "progress"})
      }
    }
  }
}

class NormalDistribution {
  max: number
  min: number

  constructor({mean, min}: {mean: number; min: number}) {
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

// Person encapsulates an individual within the simulation.
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
  model: Model
  score: number
  spread: number
  status: number
  testDay: number
  tokens: number[][]
  x: number
  y: number

  constructor(attrs: number, id: number, model: Model) {
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
    this.model = model
    this.score = 0
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
  deposit(from: number, depth: number, people: Person[], offset: number) {
    if (this.status === STATUS_DEAD) {
      return
    }
    this.tokens[this.tokens.length - 1][offset + depth] += 1
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
        people[id].deposit(this.id, depth, people, offset)
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
    const model = this.model
    this.gen = gen
    this.infectedDay = model.day
    this.infectionEndDay =
      model.day +
      model.cfg.preInfectiousDays +
      model.cfg.preSymptomaticInfectiousDays +
      model.cfg.illness.sample(model.rng)
    this.immunityEndDay =
      this.infectionEndDay + model.cfg.immunity.sample(model.rng)
    this.status &= ~STATUS_HEALTHY
    this.status &= ~STATUS_RECOVERED
    this.status |= STATUS_INFECTED
    return true
  }

  infected() {
    return (this.status & STATUS_INFECTED) !== 0
  }

  installSafetyScore(day: number) {
    if (this.appInstalled()) {
      return
    }
    this.attrs |= PERSON_APP_INSTALLED
    this.installDate = day
    this.tokens.push([0, 0, 0, 0, 0, 0])
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

  constructor({max, mean, min}: {max: number; mean: number; min: number}) {
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
  ctrl: Controller
  ctx: CanvasRenderingContext2D
  heading: string
  hidden: boolean
  id: number
  method: number
  progress: number
  results: Stats[]
  width: number
  worker: AbstractedWorker
  $canvas: HTMLCanvasElement
  $download: HTMLElement
  $root: HTMLElement
  $summary: HTMLElement

  constructor(ctrl: Controller, method: number) {
    this.ctrl = ctrl
    this.heading = getMethodLabel(method)
    this.hidden = false
    this.method = method
    this.progress = 0
    this.results = []
    this.width = 0
  }

  handleMessage(resp: WorkerResponse) {
    if (this.id !== resp.id) {
      return
    }
    if (resp.type === "results") {
      this.worker.terminate()
      show(this.$download)
      this.results = resp.results
      this.renderSummary()
      this.renderGraph()
      if (this.method === METHOD_SAFETYSCORE) {
        console.log(
          "SafetyScore Installs",
          this.results[this.results.length - 1].installed
        )
      }
      return
    }
    this.progress = resp.day
    this.renderProgress()
  }

  hide() {
    if (this.hidden) {
      return
    }
    this.hidden = true
    hide(this.$root)
  }

  pause() {}

  render() {
    if (!IN_BROWSER) {
      return
    }
    if (this.hidden || configDisplayed) {
      return
    }
  }

  renderGraph() {
    if (!IN_BROWSER) {
      return
    }
    const ctx = this.ctx
    const results = this.results
    if (results.length === 0) {
      ctx.fillStyle = "#eeeeee"
      ctx.fillRect(0, 0, this.width, 200)
      return
    }
    const days = results.length
    const last = results[results.length - 1]
    const total = last.healthy + last.dead + last.recovered + last.infected
    // const infected = []
    // for (let i = 0; i < results.length; i++) {
    //   infected.push()
    // }
    const height = 200
    // const width = this.width / days
    const width = Math.max(1, Math.floor(this.width / days))

    // let prevX = width * prevDay
    for (let day = 1; day < results.length; day++) {
      const cur = results[day]
      const prevDay = day - 1
      const prev = results[prevDay]
      const curX = width * day
      const prevX = width * prevDay
      let stat = 0
      let prevStat = 0
      // Draw the dead.
      ctx.fillStyle = COLOUR_DEAD
      ctx.fillRect(prevX, 0, width, height)
      stat += cur.dead / total
      prevStat += prev.dead / total
      // Draw the recovered.
      ctx.fillStyle = COLOUR_RECOVERED
      ctx.beginPath()
      ctx.moveTo(prevX, prevStat * height)
      ctx.lineTo(curX, stat * height)
      ctx.lineTo(curX, height)
      ctx.lineTo(prevX, height)
      ctx.fill()
      stat += cur.recovered / total
      prevStat += prev.recovered / total
      // Draw the healthy.
      ctx.fillStyle = COLOUR_HEALTHY
      ctx.beginPath()
      ctx.moveTo(prevX, prevStat * height)
      ctx.lineTo(curX, stat * height)
      ctx.lineTo(curX, height)
      ctx.lineTo(prevX, height)
      ctx.fill()
      stat += cur.healthy / total
      prevStat += prev.healthy / total
      // Draw the infected.
      ctx.fillStyle = COLOUR_INFECTED
      ctx.beginPath()
      ctx.moveTo(prevX, prevStat * height)
      ctx.lineTo(curX, stat * height)
      ctx.lineTo(curX, height)
      ctx.lineTo(prevX, height)
      ctx.fill()
    }
  }

  renderProgress() {
    if (!IN_BROWSER) {
      return
    }
    this.$summary.innerHTML = `Calculating day ${this.progress} ...`
  }

  renderSummary() {
    if (!IN_BROWSER) {
      return
    }
    const results = this.results
    const days = results.length
    const last = results[results.length - 1]
    const total = last.healthy + last.dead + last.recovered + last.infected
    const healthy = (last.healthy / total) * 100
    const infected = 100 - healthy
    const dead = (last.dead / total) * 100
    let isolated = 0
    for (let i = 0; i < results.length; i++) {
      isolated += results[i].isolated
    }
    isolated = (isolated / (days * total)) * 100
    // const lost = Math.round(isolated / total)
    const $summary = (
      <div class="summary">
        <div>
          Days<div class="right">{days}</div>
        </div>
        <div>
          Isolated<div class="right value">{percent(isolated)}</div>
        </div>
        <div>
          Healthy<div class="right value-healthy">{percent(healthy)}</div>
        </div>
        <div>
          Infected<div class="right value-infected">{percent(infected)}</div>
        </div>
        <div>
          Dead<div class="right value-dead">{percent(dead)}</div>
        </div>
      </div>
    )
    this.$summary.replaceWith($summary)
    this.$summary = $summary
  }

  run(cfg: string, id: number, rand: number) {
    if (this.worker) {
      this.worker.terminate()
    }
    if (this.hidden) {
      this.hidden = false
      show(this.$root)
    }
    this.progress = 0
    this.results = []
    this.renderGraph()
    this.renderProgress()
    hide(this.$download)
    this.id = id
    this.worker = new AbstractedWorker("./simulation.js")
    this.worker.onMessage((msg: WorkerResponse) => this.handleMessage(msg))
    this.worker.postMessage({cfg, id, method: this.method, rand})
  }

  setDimensions() {
    if (!IN_BROWSER) {
      return
    }
    if (this.hidden) {
      return
    }
    let width = this.$root.offsetWidth - this.$summary.offsetWidth
    if (width < 200) {
      width = 200
    }
    this.$canvas.width = width
    this.$canvas.style.height = "200px"
    this.$canvas.style.width = `${width}px`
    this.width = width
    this.render()
  }

  setupUI() {
    const $canvas = <canvas class="graph" height="200"></canvas>
    const $download = (
      <div class="action">
        <img src="download.svg" alt="Download" />
        <span>Download File</span>
      </div>
    )
    hide($download)
    const $run = (
      <div class="action">
        <img class="refresh" src="refresh.svg" alt="Refresh" />
        <span>Run New Simulation</span>
      </div>
    )
    $run.addEventListener("click", (e: any) => this.ctrl.randomise())
    const $settings = (
      <div class="action">
        <img src="settings.svg" alt="Settings" />
        <span>Edit Config</span>
      </div>
    )
    $settings.addEventListener("click", displayConfig)
    const $summary = <div class="summary">Infected</div>
    const $root = (
      <div class="simulation">
        <div class="heading">{this.heading}</div>
        {$settings}
        {$run}
        {$download}
        <div class="clear"></div>
        {$summary}
        {$canvas}
        <div class="clear"></div>
      </div>
    )
    const ctx = $canvas.getContext("2d") as CanvasRenderingContext2D
    ctx.globalCompositeOperation = "destination-over"
    ctx.imageSmoothingEnabled = false
    this.ctx = ctx
    this.$canvas = $canvas
    this.$download = $download
    this.$root = $root
    this.$summary = $summary
    return $root
  }

  show() {
    if (!this.hidden) {
      return
    }
    this.hidden = false
    show(this.$root)
  }

  terminate() {
    this.worker.terminate()
  }
}

function getMethodID(method: number) {
  if (method === METHOD_APPLE_GOOGLE) {
    return "apple-google"
  }
  if (method === METHOD_FREE_MOVEMENT) {
    return "free-movement"
  }
  if (method === METHOD_LOCKDOWN) {
    return "lockdowns"
  }
  if (method === METHOD_SAFETYSCORE) {
    return "safetyscore"
  }
  throw `Unknown method: ${method}`
}

function getMethodLabel(method: number) {
  if (method === METHOD_APPLE_GOOGLE) {
    return "Apple/Google-Style Contact Tracing"
  }
  if (method === METHOD_FREE_MOVEMENT) {
    return "Free Movement"
  }
  if (method === METHOD_LOCKDOWN) {
    return "Lockdowns"
  }
  if (method === METHOD_SAFETYSCORE) {
    return "SafetyScore"
  }
  throw `Unknown method: ${method}`
}

// Derived from https://github.com/willscott/zipfian
class ZipfDistribution {
  eta: number
  items: number
  max: number
  min: number
  zetan: number

  constructor({max, min}: {max: number; min: number}) {
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

function defaultConfig(): Config {
  return {
    // the portion of people who have an Apple/Google-style Contact Tracing app installed
    appleGoogleInstalled: 2 / 3,
    // distribution of the number of clusters for a person
    clusterCount: new ZipfDistribution({min: 1, max: 5}),
    // distribution of the number of "primary" members in a cluster
    clusterSize: new PoissonDistribution({mean: 20, min: 1, max: 50}),
    // the portion of the population that can be tested
    dailyTestCapacity: 0.01,
    // number of days to run the simulation
    days: 300,
    // the likelihood of a SafetyScore user being okay with visiting a non-gate-kept cluster
    exposedVisit: 0.5,
    // likelihood of dying once infected
    fatalityRisk: 0.01,
    // daily likelihood of someone in the whole population getting infected from outside the population
    foreignImports: 0.06,
    // the portion of clusters who gate-keep access via SafetyScore
    gatekeptClusters: 1 / 3,
    // the SafetyScore level needed to access a gate-kept cluster
    gatekeptThreshold: 50,
    // distribution of the group size within a cluster for a single period
    groupSize: new PoissonDistribution({mean: 2.5, min: 2, max: 20}),
    // distribution of the number of people in a household [not used yet]
    household: new PoissonDistribution({mean: 2.1, min: 1, max: 6}),
    // distribution of illness days after incubation
    illness: new NormalDistribution({mean: 10.5, min: 7}),
    // distribution of the days of natural immunity
    immunity: new NormalDistribution({mean: 238, min: 0}),
    // likelihood of someone getting infected during a single contact
    infectionRisk: 0.01,
    // likelihood of someone installing SafetyScore for visiting a foreign gate-kept cluster
    installForeign: 0.2,
    // likelihood of someone installing SafetyScore for visiting an own gate-kept cluster
    installOwn: 0.95,
    // likelihood of someone installing SafetyScore for the household when installOwn
    installOwnHousehold: 0,
    // isolate whole household if someone self-isolates
    isolateHousehold: true,
    // number of days a person should self-isolate
    isolationDays: 21,
    // likelihood of a self-isolating person staying at home for any given period during the day
    isolationEffectiveness: 0.9,
    // likelihood of a notified person self-isolating
    isolationLikelihood: 0.9,
    // likelihood of an isolated person staying at home for any given period during lockdown
    isolationLockdown: 0.95,
    // the SafetyScore level below which one is notified to self-isolate and test
    isolationThreshold: 50,
    // portion of the population who will not be isolated during lockdown
    keyWorkers: 0.16,
    // the number of infected people, below which a lockdown could end
    lockdownEnd: 5,
    // number of days the number of infected people must be below "lockdownEnd" before lockdown ends
    lockdownEndWindow: 14,
    // the number of infected people which will trigger a lockdown
    lockdownStart: 10,
    // format of the generated output file, can be "csv", "png", or "svg"
    outputFormat: "png",
    // total number of people
    population: 10000,
    // number of days before becoming infectious
    preInfectiousDays: 3,
    // number of days of being infectious before possibly becoming symptomatic
    preSymptomaticInfectiousDays: 3,
    // portion of clusters which are public
    publicClusters: 0.15,
    // choose which simulations to run
    runAppleGoogle: true,
    runFreeMovement: true,
    runLockdown: true,
    runSafetyScore: true,
    // the portion of people who have SafetyScore installed at the start
    safetyScoreInstalled: 0,
    // a multiplicative weighting factor for second-degree tokens
    secondDegreeWeight: 1,
    // likelihood of a symptomatic person self-attesting
    selfAttestation: 0,
    // the portion of people who become symptomatic
    symptomatic: 0.2,
    // the distribution of the delay days between symptomatic/notified and testing
    testDelay: new PoissonDistribution({mean: 2, min: 1, max: 10}),
    // test all key workers
    testKeyWorkers: true,
    // likelihood of a key worker getting tested
    testKeyWorker: 1,
    // likelihood of a person getting themselves tested if symptomatic/notified
    testing: 0.7,
    // portion of people who have long-lasting immunity from vaccination
    vaccinated: 0,
    // likelihood of visiting a "foreign" cluster during a period
    visitForeignCluster: 0.2,
    // likelihood of visiting a public cluster when visiting a foreign cluster
    visitPublicCluster: 0.15,
  }
}

function defaultConfigDefinition() {
  let cfg = defaultConfig.toString()
  const start = cfg.indexOf("{", cfg.indexOf("{") + 1)
  const end = cfg.indexOf("};")
  cfg = cfg
    .slice(start, end)
    .trim()
    .split(",\n        //")
    .join(",\n\n    //")
    .split("        ")
    .join("    ")
  return cfg + "\n}"
}

function displayConfig() {
  if (configDisplayed || !ctrl) {
    return
  }
  configDisplayed = true
  if (!$config) {
    $config = $("config") as HTMLTextAreaElement
    $mirror = $("mirror") as HTMLPreElement
  }
  $config.value = ctrl.definition
  updateMirror(ctrl.definition)
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
  switch (graph.this.method) {
    case METHOD_APPLE_GOOGLE:
      filename += "-apple-google"
      break
    case METHOD_FREE_MOVEMENT:
      filename += "-free-movement"
      break
    case METHOD_LOCKDOWN:
      filename += "-lockdown"
      break
    case METHOD_SAFETYSCORE:
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

function getMean(dist: Distribution) {
  const rng = new RNG("mean")
  let val = 0
  for (let i = 0; i < 10000; i++) {
    val += dist.sample(rng)
  }
  return val / 10000
}

function getMethod(s: string) {
  let method
  switch (s) {
    case "apple-google":
      method = METHOD_APPLE_GOOGLE
      break
    case "lockdown":
      method = METHOD_LOCKDOWN
      break
    case "free-movement":
      method = METHOD_FREE_MOVEMENT
      break
    case "safetyscore":
      method = METHOD_SAFETYSCORE
      break
    default:
      throw `Unknown method: ${s}`
  }
  return method
}

function getZeta(n: number, theta: number) {
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += 1 / Math.pow(i + 1, theta)
  }
  return sum
}

function h(
  tag: string,
  props?: ElemProps,
  ...children: Array<string | HTMLElement>
) {
  const elem = document.createElement(tag)
  if (props) {
    const keys = Object.keys(props)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const val = (props as Record<string, any>)[key]
      if (key === "class") {
        elem.className = val
      } else if (key === "onclick") {
        elem.addEventListener("click", val)
      } else {
        elem.setAttribute(key, val)
      }
    }
  }
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (typeof child === "string" || typeof child === "number") {
      elem.appendChild(document.createTextNode(child))
    } else {
      elem.appendChild(child)
    }
  }
  return elem
}

function handleInlayClick(e: Event) {
  e.stopPropagation()
}

function handleKeyboard(e: KeyboardEvent) {
  if (configDisplayed) {
    if (e.code === "Escape") {
      handleOverlayClick()
      return
    }
    if (e.ctrlKey && e.code === "Enter") {
      updateConfig()
      return
    }
    return
  }
  if (e.code === "KeyE") {
    displayConfig()
    return
  }
  if (e.code === "KeyR" && ctrl) {
    ctrl.randomise()
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
  if (ctrl) {
    ctrl.resume()
  }
}

function handleResize() {
  if (ctrl) {
    ctrl.setDimensions()
  }
}

function hide(elem: HTMLElement) {
  if (IN_BROWSER) {
    elem.style.display = "none"
  }
}

function includes<T>(array: Array<T>, value: T) {
  for (let i = 0; i < array.length; i++) {
    if (array[i] === value) {
      return true
    }
  }
  return false
}

function percent(v: number) {
  if (v < 1 || v > 99) {
    v = parseFloat(v.toFixed(2))
    if (v == 0) {
      return "0"
    }
    return `${v}%`
  }
  return `${Math.round(v)}%`
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

function scrollEditor() {
  $mirror.scrollTop = $config.scrollTop
}

function sendMessage(resp: WorkerResponse) {
  if (IN_BROWSER) {
    postMessage(resp)
  } else {
    parentPort.postMessage(resp)
  }
}

function show(elem: HTMLElement) {
  if (IN_BROWSER) {
    elem.style.display = "block"
  }
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
  configDisplayed = false
  $("overlay").style.display = "none"
  ctrl.runNew(cfg, definition)
}

function updateMirror(src: string) {
  const code = Prism.highlight(src, Prism.languages.javascript)
  $mirror.innerHTML = code
}

function validateConfig(cfg: Config) {
  const v = new ConfigValidator(cfg)
  v.validateBoolean([
    "isolateHousehold",
    "runAppleGoogle",
    "runFreeMovement",
    "runLockdown",
    "runSafetyScore",
    "testKeyWorkers",
  ])
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
    "lockdownEnd",
    "lockdownEndWindow",
    "lockdownStart",
    "population",
    "preInfectiousDays",
    "preSymptomaticInfectiousDays",
  ])
  v.validatePercentage([
    "appleGoogleInstalled",
    "dailyTestCapacity",
    "exposedVisit",
    "fatalityRisk",
    "foreignImports",
    "gatekeptClusters",
    "infectionRisk",
    "installForeign",
    "installOwn",
    "installOwnHousehold",
    "isolationEffectiveness",
    "isolationLikelihood",
    "isolationLockdown",
    "keyWorkers",
    "publicClusters",
    "safetyScoreInstalled",
    "secondDegreeWeight",
    "selfAttestation",
    "symptomatic",
    "testKeyWorker",
    "testing",
    "vaccinated",
    "visitForeignCluster",
    "visitPublicCluster",
  ])
  v.validateScore(["gatekeptThreshold", "isolationThreshold"])
  v.validateStringValue("outputFormat", ["csv", "png", "svg"])
  v.checkFields()
  if (
    !cfg.runAppleGoogle &&
    !cfg.runFreeMovement &&
    !cfg.runLockdown &&
    !cfg.runSafetyScore
  ) {
    throw 'At least one of "runAppleGoogle", "runFreeMovement", "runLockdown", or "runSafetyScore" must be set'
  }
  return cfg
}

function main() {
  if (IN_BROWSER) {
    if (IN_WORKER) {
      const model = new Model()
      self.onmessage = (e: MessageEvent) => model.handleMessage(e.data)
    } else {
      document.addEventListener("keyup", handleKeyboard)
      $("config").addEventListener("keyup", syncEditor)
      $("config").addEventListener("scroll", scrollEditor)
      $("inlay").addEventListener("click", handleInlayClick)
      $("overlay").addEventListener("click", handleOverlayClick)
      $("update-config").addEventListener("click", updateConfig)
      ctrl = new Controller()
      ctrl.initBrowser()
    }
  } else {
    const worker = require("worker_threads")
    if (worker.isMainThread) {
      const method = getMethod(getCmdOpt("--method", "safetyscore"))
      ctrl = new Controller()
      ctrl.initNodeJS(method)
    } else {
      const model = new Model()
      parentPort = worker.parentPort
      parentPort.on("message", (msg: WorkerRequest) => model.handleMessage(msg))
    }
  }
}

if (IN_BROWSER && !IN_WORKER) {
  window.addEventListener("load", main)
  window.addEventListener("resize", handleResize)
} else {
  main()
}
