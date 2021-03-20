import * as M from 'https://unpkg.com/frmidi'
import * as R from 'https://cdn.skypack.dev/ramda'
import * as X from 'https://cdn.skypack.dev/rxjs'
import * as O from 'https://cdn.skypack.dev/rxjs/operators'

export let AS_SETTINGS = 0
export let RED = 1
export let YELLOW = 2
export let GREEN = 3
export let CYAN = 4
export let BLUE = 5
export let MAGENTA = 6
export let OFF = 7
export let WHITE = 8
export let ORANGE = 9
export let LIME = 10
export let PINK = 11

export let setColor = (x, y, c) =>
  M.from ([
    M.cc (20, x),
    M.cc (21, y),
    M.cc (22, c)
  ])

export let clear = (c = 7) =>
  X.from (
    R.flatten (
      R.map ((x) =>
        R.map ((y) => setColor (x, y, c)) (R.range (0, 8))
        ) (R.range (0, 17))))

export let restore = () =>
  clear (AS_SETTINGS)

// Each cell of state expects an object with:
// onNoteOn
// onNoteOff
// onPitchBend
// onTimbre
// onPressure
// active
// channel
export let createState = () =>
  R.map ((x) => R.map ((y) => ({})) (R.range (0, 8))) (R.range (0, 17))

export let listener = (state) => (input) => {
  input.pipe (
    O.filter (M.isNoteOn),
  ).subscribe ((v) => {
      let x = R.view (M.note) (v) % 16 + 1
      let y = R.view (M.note) (v) >> 4

      if (state [x][y].onNoteOn !== undefined)
        state [x][y].onNoteOn (v, state[x][y].status)

      if (state [x][y].onPitchBend !== undefined)
        state [x][y].unsubscriberPitchBend = 
          input.pipe (
            O.filter (
              R.both (
                M.isPitchBend,
                M.isOnChannel (R.view (M.channel) (v))
              )
            )
          ).subscribe ((v) => state [x][y].onPitchBend (v, state[x][y].status))

      if (state [x][y].onTimbreChange !== undefined)
        state [x][y].unsubscriberTimbreChange = 
          input.pipe (
            O.filter (
              R.both (
                M.isTimbreChange,
                M.isOnChannel (R.view (M.channel) (v))
              )
            )
          ).subscribe (state [x][y].onTimbreChange)

      if (state[x][y].onPressure !== undefined)
        state[x][y].unsubscriberPressure =
          input.pipe 
            (O.filter 
              (R.both 
                (M.isPolyPressure)
                (M.isOnChannel (R.view (M.channel) (v)))
              )
            ).subscribe ((v) => state [x][y].onPressure (v, state[x][y].status))         

      // Note off and cleaning
      state[x][y].unsubscriberNoteOff =
        input.pipe 
          (O.filter 
            (R.both 
              (M.isNoteOff)
              (M.isOnChannel (R.view (M.channel) (v))))
          ).subscribe ((v) => {
            if (state [x][y].onNoteOff !== undefined)
              state [x][y].onNoteOff (v, state[x][y].status)

            if (state[x][y].unsubscriberPitchBend !== undefined) {
              state[x][y].unsubscriberPitchBend.unsubscribe ()
              state[x][y].unsubscriberPitchBend = undefined
            }

            if (state[x][y].unsubscriberTimbreChange !== undefined) {
              state[x][y].unsubscriberTimbreChange.unsubscribe ()
              state[x][y].unsubscriberTimbreChange = undefined
            }

            if (state[x][y].unsubscriberPressure !== undefined) {
              state[x][y].unsubscriberPressure.unsubscribe ()
              state[x][y].unsubscriberPressure = undefined
            }

            if (state[x][y].unsubscriberNoteOff !== undefined) {
              state[x][y].unsubscriberNoteOff.unsubscribe ()
              state[x][y].unsubscriberNoteOff = undefined
            }
          }) 
  })
}

export let createToggle = (x) => (y) => (color_off) => (color_on) => (msg_off) => (msg_on) => (lout) => (sout) => (state) => 
{
  lout (setColor (x, y, color_off))

  state[x][y] = {
    status: { toggled: false },
    onNoteOn: (v, cell) => {
      cell.toggled = !cell.toggled

      if (cell.toggled) {
        sout (R.set (M.channel) (1) (msg_on))
        lout (setColor (x, y, color_on))
      } else {
        sout (R.set (M.channel) (1) (msg_off))
        lout (setColor (x, y, color_off))
      }
    }
  }

  return state
}

export let createCC14bit = (x) => (y) => (color) => (ch) => (cc) => (lout) => (sout) => (state) => {
  lout (setColor (x, y, color))

  state[x][y] = {
    status: { 
        value: 8192,
        tempPB: 8192,
        pressure: 0,
    },
    onPressure: (v, status) => {
      status.pressure = v.data [2]
    },
    onPitchBend: (v, status) => {
      let mod = status.pressure < 96 ? 0.01 : 1 //(status.pressure < 112 ? 1 : 12)
      let pb = M.value14bit (v.data [2], v.data [1])

      let diff = pb - status.tempPB
      status.tempPB = pb

      status.value = 
        Math.round (
          R.clamp (
            0, 
            16383, 
            status.value + diff * mod))

      sout (
        M.cc14bit (
          cc, 
          status.value))
    },
    onNoteOff: (v, status) => {
      status.tempPB = 8192
    }
  }

  return state
}

export let StAnneController = (lout) => (sout) => {
  let state = createState ()
  // Row 7
  // Swell
  state = createToggle (1) (7) (CYAN) (MAGENTA) (M.on (0, 0)) (M.on (0)) (lout) (sout) (state)
  state = createToggle (2) (7) (CYAN) (MAGENTA) (M.on (1, 0)) (M.on (1)) (lout) (sout) (state)
  state = createToggle (3) (7) (CYAN) (MAGENTA) (M.on (2, 0)) (M.on (2)) (lout) (sout) (state)
  // Great
  state = createToggle (14) (7) (CYAN) (MAGENTA) (M.on (3, 0)) (M.on (3)) (lout) (sout) (state)
  state = createToggle (15) (7) (CYAN) (MAGENTA) (M.on (4, 0)) (M.on (4)) (lout) (sout) (state)
  // Pedal
  state = createToggle (16) (7) (PINK) (ORANGE) (M.on (5, 0)) (M.on (5)) (lout) (sout) (state)

  // Row 6
  // Swell
  state = createToggle (1) (6) (CYAN) (MAGENTA) (M.on (6, 0)) (M.on (6)) (lout) (sout) (state)
  state = createToggle (2) (6) (CYAN) (MAGENTA) (M.on (7, 0)) (M.on (7)) (lout) (sout) (state)
  state = createToggle (3) (6) (CYAN) (MAGENTA) (M.on (8, 0)) (M.on (8)) (lout) (sout) (state)
  // Great
  state = createToggle (14) (6) (CYAN) (MAGENTA) (M.on (9, 0)) (M.on (9)) (lout) (sout) (state)
  state = createToggle (15) (6) (CYAN) (MAGENTA) (M.on (10, 0)) (M.on (10)) (lout) (sout) (state)
  // Pedal
  state = createToggle (16) (6) (PINK) (ORANGE) (M.on (11, 0)) (M.on (11)) (lout) (sout) (state) 
  
  // Row 5
  // Swell
  state = createToggle (1) (5) (CYAN) (MAGENTA) (M.on (12, 0)) (M.on (12)) (lout) (sout) (state)
  state = createToggle (2) (5) (CYAN) (MAGENTA) (M.on (13, 0)) (M.on (13)) (lout) (sout) (state)
  state = createToggle (3) (5) (CYAN) (MAGENTA) (M.on (14, 0)) (M.on (14)) (lout) (sout) (state)
  // Great
  state = createToggle (14) (5) (CYAN) (MAGENTA) (M.on (15, 0)) (M.on (15)) (lout) (sout) (state)
  state = createToggle (15) (5) (CYAN) (MAGENTA) (M.on (16, 0)) (M.on (16)) (lout) (sout) (state)
  // Pedal
  state = createToggle (16) (5) (PINK) (ORANGE) (M.on (17, 0)) (M.on (17)) (lout) (sout) (state) 

  // Row 4
  // Swell
  state = createToggle (1) (4) (CYAN) (MAGENTA) (M.on (18, 0)) (M.on (18)) (lout) (sout) (state)
  state = createToggle (2) (4) (CYAN) (MAGENTA) (M.on (19, 0)) (M.on (19)) (lout) (sout) (state)
  state = createToggle (3) (4) (CYAN) (MAGENTA) (M.on (20, 0)) (M.on (20)) (lout) (sout) (state)
  // Great
  state = createToggle (14) (4) (CYAN) (MAGENTA) (M.on (21, 0)) (M.on (21)) (lout) (sout) (state)
  state = createToggle (15) (4) (CYAN) (MAGENTA) (M.on (22, 0)) (M.on (22)) (lout) (sout) (state)
  // Pedal
  state = createToggle (16) (4) (PINK) (ORANGE) (M.on (23, 0)) (M.on (23)) (lout) (sout) (state) 

  // Row 3
  // Swell
  state = createToggle (1) (3) (CYAN) (MAGENTA) (M.on (24, 0)) (M.on (24)) (lout) (sout) (state)
  state = createToggle (3) (3) (CYAN) (MAGENTA) (M.on (25, 0)) (M.on (25)) (lout) (sout) (state)
  // Great
  state = createToggle (14) (3) (CYAN) (MAGENTA) (M.on (26, 0)) (M.on (26)) (lout) (sout) (state)
  state = createToggle (15) (3) (CYAN) (MAGENTA) (M.on (27, 0)) (M.on (27)) (lout) (sout) (state)
  // Pedak
  state = createToggle (16) (3) (PINK) (ORANGE) (M.on (28, 0)) (M.on (28)) (lout) (sout) (state) 

  // Row 2
  // Swell
  state = createToggle (1) (2) (CYAN) (MAGENTA) (M.on (29, 0)) (M.on (29)) (lout) (sout) (state)
  state = createToggle (2) (2) (CYAN) (MAGENTA) (M.on (30, 0)) (M.on (30)) (lout) (sout) (state)
  state = createToggle (3) (2) (CYAN) (MAGENTA) (M.on (31, 0)) (M.on (31)) (lout) (sout) (state)
  // Great
  state = createToggle (14) (2) (CYAN) (MAGENTA) (M.on (32, 0)) (M.on (32)) (lout) (sout) (state)
  state = createToggle (15) (2) (CYAN) (MAGENTA) (M.on (33, 0)) (M.on (33)) (lout) (sout) (state)
  // Pedal
  state = createToggle (16) (2) (PINK) (ORANGE) (M.on (34, 0)) (M.on (34)) (lout) (sout) (state) 

  // Row 1
  // Swell
  state = createToggle (1) (1) (CYAN) (MAGENTA) (M.on (35, 0)) (M.on (35)) (lout) (sout) (state)
  state = createToggle (2) (1) (CYAN) (MAGENTA) (M.on (36, 0)) (M.on (36)) (lout) (sout) (state)
  // Great
  state = createToggle (14) (1) (CYAN) (MAGENTA) (M.on (37, 0)) (M.on (37)) (lout) (sout) (state)
  state = createToggle (15) (1) (CYAN) (MAGENTA) (M.on (38, 0)) (M.on (38)) (lout) (sout) (state)
  // Pedal
  state = createToggle (16) (1) (PINK) (ORANGE) (M.on (39, 0)) (M.on (39)) (lout) (sout) (state) 


  // VCV Rack testing
  // 7th row
  state = createCC14bit (5) (7) (RED) (1) (1) (lout) (sout) (state)
  state = createCC14bit (6) (7) (RED) (1) (2) (lout) (sout) (state)
  state = createCC14bit (7) (7) (RED) (1) (3) (lout) (sout) (state)
  state = createCC14bit (8) (7) (RED) (1) (4) (lout) (sout) (state)
  state = createCC14bit (9) (7) (YELLOW) (1) (5) (lout) (sout) (state)
  state = createCC14bit (10) (7) (YELLOW) (1) (6) (lout) (sout) (state)
  state = createCC14bit (11) (7) (YELLOW) (1) (7) (lout) (sout) (state)
  state = createCC14bit (12) (7) (YELLOW) (1) (8) (lout) (sout) (state)
  // 6th row
  state = createCC14bit (5) (6) (RED) (1) (9) (lout) (sout) (state)
  state = createCC14bit (6) (6) (RED) (1) (10) (lout) (sout) (state)
  state = createCC14bit (7) (6) (RED) (1) (11) (lout) (sout) (state)
  state = createCC14bit (8) (6) (RED) (1) (12) (lout) (sout) (state)
  state = createCC14bit (9) (6) (YELLOW) (1) (13) (lout) (sout) (state)
  state = createCC14bit (10) (6) (YELLOW) (1) (14) (lout) (sout) (state)
  state = createCC14bit (11) (6) (YELLOW) (1) (15) (lout) (sout) (state)
  state = createCC14bit (12) (6) (YELLOW) (1) (16) (lout) (sout) (state)
  // 5th row
  state = createCC14bit (5) (5) (RED) (1) (17) (lout) (sout) (state)
  state = createCC14bit (6) (5) (RED) (1) (18) (lout) (sout) (state)
  state = createCC14bit (7) (5) (RED) (1) (19) (lout) (sout) (state)
  state = createCC14bit (8) (5) (RED) (1) (20) (lout) (sout) (state)
  state = createCC14bit (9) (5) (YELLOW) (1) (21) (lout) (sout) (state)
  state = createCC14bit (10) (5) (YELLOW) (1) (22) (lout) (sout) (state)
  state = createCC14bit (11) (5) (YELLOW) (1) (23) (lout) (sout) (state)
  state = createCC14bit (12) (5) (YELLOW) (1) (24) (lout) (sout) (state)
  // 4th row
  state = createCC14bit (5) (4) (RED) (1) (25) (lout) (sout) (state)
  state = createCC14bit (6) (4) (RED) (1) (26) (lout) (sout) (state)
  state = createCC14bit (7) (4) (RED) (1) (27) (lout) (sout) (state)
  state = createCC14bit (8) (4) (RED) (1) (28) (lout) (sout) (state)
  state = createCC14bit (9) (4) (YELLOW) (1) (29) (lout) (sout) (state)
  state = createCC14bit (10) (4) (YELLOW) (1) (30) (lout) (sout) (state)
  state = createCC14bit (11) (4) (YELLOW) (1) (31) (lout) (sout) (state)
  state = createCC14bit (12) (4) (YELLOW) (1) (32) (lout) (sout) (state)  
  
  return state
}

M.initialize ().then (() => {
  let lin = M.input ('LinnStrument')
  let lout = M.output ('LinnStrument')
  //let sout = M.output ('VCV2Live')
  //let sout = (v) => console.log (v.data)
  let sout = M.output ('Port-0')

  clear (OFF).subscribe (lout)

  listener (StAnneController (lout) (sout)) (lin)
})