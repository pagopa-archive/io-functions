const getMessage = (req : any, res: any) => {
    const context = req.app.get('context')
    context.log('getMessage')
    res.json('getMessage')
}

const submitMessageforUser = (req : any, res: any) => {
    const context = req.app.get('context')
    context.log('submitMessage')
    res.json('submitMessageforUser')
}

module.exports = { getMessage, submitMessageforUser }
