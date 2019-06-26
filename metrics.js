module.exports = {
    incrementCounter: (message, config) => {
        console.log("TCL: message,config", message, config)

    },
    observeHistogram: (message, time, config) => {
        console.log("TCL: message, time, config", message, time, config)

    },
    decrementGauge: (message, config) => {
        console.log("TCL: message, config", message, config)

    },
    incrementGauge: (message, config) => {
        console.log("TCL: message, config", message, config)

    }
}