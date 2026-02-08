const outApi = (Code, Message, Data = null) => {
	return {
		code: Code,
		message: Message,
		data: Data
	}
}

export default outApi