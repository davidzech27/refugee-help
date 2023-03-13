const WhatsApp = {
	sendText: async ({
		fromPhoneNumberId,
		toPhoneNumber,
		body,
		metaAccessToken,
	}: {
		fromPhoneNumberId: string;
		toPhoneNumber: string;
		body: string;
		metaAccessToken: string;
	}) => {
		await fetch(
			`https://graph.facebook.com/v16.0/${fromPhoneNumberId}/messages`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${metaAccessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					messaging_product: "whatsapp",
					recipient_type: "individual",
					to: toPhoneNumber,
					type: "text",
					text: {
						preview_url: false,
						body,
					},
				}),
			}
		);
	},
	sendButtons: async ({
		fromPhoneNumberId,
		toPhoneNumber,
		body,
		metaAccessToken,
	}: {
		fromPhoneNumberId: string;
		toPhoneNumber: string;
		body: string;
		metaAccessToken: string;
	}) => {
		await fetch(
			`https://graph.facebook.com/v16.0/${fromPhoneNumberId}/messages`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${metaAccessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					messaging_product: "whatsapp",
					recipient_type: "individual",
					to: toPhoneNumber,
					// type: "text",
					// text: {
					// 	preview_url: false,
					// 	body,
					// },
				}),
			}
		);
	},
};

export default WhatsApp;
