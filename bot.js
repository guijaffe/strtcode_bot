import { Bot, InlineKeyboard } from "grammy";
import "dotenv/config";
import fs from "fs";
import path from "path";

// Инициализация бота
const bot = new Bot(process.env.BOT_TOKEN);

// ID администратора
const adminChatId = process.env.ADMIN_CHAT_ID;

// Хранение состояния пользователей
const userStates = new Map();

// Хранение всех пользователей бота
const allUsers = new Set();

// Категории товаров и их наценки (комиссии)
const categories = {
	sneakers: { name: "Кроссовки", markup: 2000 },
	winter_shoes: { name: "Зимняя обувь", markup: 2300 },
	hoodie: { name: "Худи", markup: 2000 },
	winter_jacket: { name: "Зимняя куртка", markup: 2500 },
	windbreaker: { name: "Ветровка", markup: 1900 },
};

// Инлайн-клавиатура для связи с администратором
const contactAdminKeyboard = new InlineKeyboard().text(
	"Связаться с администратором",
	"contact_admin"
);

// Инлайн-клавиатура для главного меню
const mainMenuKeyboard = new InlineKeyboard()
	.text("Рассчитать заказ", "calculate_order")
	.row()
	.text("Инструкции", "show_instructions")
	.row()
	.text("Связаться с администратором", "contact_admin");

// Инлайн-клавиатура для выбора категории
const categoryKeyboard = new InlineKeyboard()
	.text("Кроссовки", "category_sneakers")
	.row()
	.text("Зимняя обувь", "category_winter_shoes")
	.row()
	.text("Худи", "category_hoodie")
	.row()
	.text("Зимняя куртка", "category_winter_jacket")
	.row()
	.text("Ветровка", "category_windbreaker")
	.row()
	.text("Вернуться в главное меню", "back_to_main_menu");

// Инлайн-клавиатура для оформления заказа
const orderKeyboard = new InlineKeyboard()
	.text("Начать оформление заказа", "start_order")
	.row()
	.text("Рассчитать еще", "calculate_again")
	.row()
	.text("Вернуться в главное меню", "back_to_main_menu");

// Инлайн-клавиатура для подтверждения заказа
const confirmOrderKeyboard = new InlineKeyboard()
	.text("Оформить заказ", "confirm_order")
	.row()
	.text("Вернуться в главное меню", "back_to_main_menu");

// Инлайн-клавиатура для выбора инструкций
const instructionsMenuKeyboard = new InlineKeyboard()
	.text("Инструкция по использованию бота", "bot_instructions")
	.row()
	.text("Инструкция по использованию Poizon", "poizon_instructions")
	.row()
	.text("На главную", "back_to_main_menu");

// Инлайн-клавиатура для инструкции по боту (без кнопки "Инструкция по использованию бота")
const botInstructionsKeyboard = new InlineKeyboard()
	.text("Инструкция по использованию Poizon", "poizon_instructions")
	.row()
	.text("На главную", "back_to_main_menu");

// Инлайн-клавиатура для инструкции по Poizon (без кнопки "Инструкция по использованию Poizon")
const poizonInstructionsKeyboard = new InlineKeyboard()
	.text("Инструкция по использованию бота", "bot_instructions")
	.row()
	.text("На главную", "back_to_main_menu");

// Удаление предыдущих сообщений
async function deletePreviousMessages(ctx, userId) {
	const userState = userStates.get(userId);
	if (userState && userState.previousMessages) {
		for (const messageId of userState.previousMessages) {
			try {
				await ctx.api.deleteMessage(ctx.chat.id, messageId);
			} catch (error) {
				if (error.description !== "Bad Request: message to delete not found") {
					console.error("Не удалось удалить сообщение:", error);
				}
			}
		}
		userState.previousMessages = [];
	}
}

// Добавление ID сообщения в список для удаления
function addMessageToDelete(userId, messageId) {
	if (!userStates.has(userId)) {
		userStates.set(userId, { previousMessages: [] });
	}
	const userState = userStates.get(userId);
	if (!userState.previousMessages) {
		userState.previousMessages = [];
	}
	userState.previousMessages.push(messageId);
}

// Обработка команды /start
bot.command("start", async (ctx) => {
	const userId = ctx.from.id;

	// Добавляем пользователя в список всех пользователей
	allUsers.add(userId);

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	const sentMessage = await ctx.reply(
		"🏠 Главное меню\n\n" +
		"Добро пожаловать в бот магазина Secret Code!\n\n" +
		"Рады видеть тебя здесь! С помощью этого бота ты сможешь:\n" +
		"✅ Рассчитать стоимость заказа.\n" +
		"✅ Оформить заказ.\n" +
		"✅ Связаться с администратором.\n\n" +
		"Если хочешь узнать больше, нажми «Инструкции».\n\n" +
		"Выбери действие:",
		{
			reply_markup: mainMenuKeyboard,
		}
	);

	// Сохраняем ID сообщения для удаления
	addMessageToDelete(userId, sentMessage.message_id);
});

// Команда /broadcast
bot.command("broadcast", async (ctx) => {
	const userId = ctx.from.id.toString();

	// Проверка на администратора
	if (userId !== adminChatId) {
		await ctx.reply("❌ У вас нет прав для этой команды.");
		return;
	}

	const messageText = ctx.message.text.split(" ").slice(1).join(" ");

	if (!messageText) {
		await ctx.reply(
			"⚠️ Пожалуйста, введите текст для рассылки.\nПример: /broadcast Новые товары уже в продаже!"
		);
		return;
	}

	let successCount = 0;
	let failCount = 0;

	// Рассылка всем пользователям
	for (const user of allUsers) {
		try {
			await ctx.api.sendMessage(
				user,
				`📢 Сообщение от администрации:\n\n${messageText}`
			);
			successCount++;
		} catch (error) {
			console.error(`Не удалось отправить сообщение пользователю ${user}:`, error);
			failCount++;
		}
	}

	await ctx.reply(
		`✅ Рассылка завершена.\n✔️ Успешно: ${successCount}\n❌ Ошибки: ${failCount}`
	);
});

// Показ меню инструкций
async function showInstructionsMenu(ctx) {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	const instructionsMenu = `
📖 Выберите инструкцию:

1. **Инструкция по использованию бота**:
   - Как пользоваться ботом для расчета и оформления заказов.

2. **Инструкция по использованию Poizon**:
   - Как пользоваться приложением Poizon для поиска товаров.
`;

	const sentMessage = await ctx.reply(instructionsMenu, {
		reply_markup: instructionsMenuKeyboard,
		parse_mode: "Markdown", // Включаем Markdown для форматирования
	});

	// Сохраняем ID сообщения для удаления
	addMessageToDelete(userId, sentMessage.message_id);
}

// Показ инструкции по использованию бота
async function showBotInstructions(ctx) {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	const botInstructions = `
📖 **Инструкция по использованию бота**:

1. **Рассчитать стоимость заказа**:
   - Нажмите кнопку "Рассчитать заказ".
   - Выберите категорию товара (например, кроссовки, зимняя обувь, худи и т.д.).
   - Введите цену товара в юанях.
   - Бот рассчитает итоговую стоимость с учетом курса и комиссии для выбранной категории.

2. **Оформить заказ**:
   - После расчета стоимости нажмите кнопку "Начать оформление заказа".
   - Отправьте ссылку на товар с мобильной версии сайта Poizon (например, dw4.co).
   - Укажите размер товара.
   - Введите артикул товара (если артикул неизвестен, напишите что угодно).
   - Подтвердите заказ, нажав кнопку "Оформить заказ".

3. **Связаться с администратором**:
   - Если у вас есть вопросы или возникли проблемы, нажмите кнопку "Связаться с администратором".
   - Напишите ваше сообщение, и администратор ответит вам в ближайшее время.

4. **Вернуться в главное меню**:
   - В любой момент вы можете вернуться в главное меню, нажав кнопку "Вернуться в главное меню".

---

Если у вас остались вопросы, свяжитесь с администратором через кнопку "Связаться с администратором".
`;

	const sentMessage = await ctx.reply(botInstructions, {
		reply_markup: botInstructionsKeyboard, // Используем клавиатуру без кнопки "Инструкция по использованию бота"
		parse_mode: "Markdown", // Включаем Markdown для форматирования
	});

	// Сохраняем ID сообщения для удаления
	addMessageToDelete(userId, sentMessage.message_id);
}

// Показ инструкции по использованию Poizon
async function showPoizonInstructions(ctx) {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	const poizonInstructions = `
📖 **Инструкция по использованию приложения Poizon**:

Для того чтобы научиться пользоваться приложением Poizon, перейдите по ссылке:
👉 [Как пользоваться приложением Poizon](https://telegra.ph/Kak-polzovatsya-prilozheniem-Poizon-01-14)

Там вы найдете подробное руководство по поиску товаров, оформлению заказов и другим функциям приложения.
`;

	const sentMessage = await ctx.reply(poizonInstructions, {
		reply_markup: poizonInstructionsKeyboard, // Используем клавиатуру без кнопки "Инструкция по использованию Poizon"
		parse_mode: "Markdown", // Включаем Markdown для форматирования
	});

	// Сохраняем ID сообщения для удаления
	addMessageToDelete(userId, sentMessage.message_id);
}

// Обработка нажатия инлайн-кнопки "Инструкции"
bot.callbackQuery("show_instructions", async (ctx) => {
	await showInstructionsMenu(ctx);
	await ctx.answerCallbackQuery();
});

// Обработка нажатия инлайн-кнопки "Инструкция по использованию бота"
bot.callbackQuery("bot_instructions", async (ctx) => {
	await showBotInstructions(ctx);
	await ctx.answerCallbackQuery();
});

// Обработка нажатия инлайн-кнопки "Инструкция по использованию Poizon"
bot.callbackQuery("poizon_instructions", async (ctx) => {
	await showPoizonInstructions(ctx);
	await ctx.answerCallbackQuery();
});

// Показ выбора категории
async function showCategorySelection(ctx) {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	const sentMessage = await ctx.reply("Выберите категорию товара:", {
		reply_markup: categoryKeyboard,
	});

	// Сохраняем ID сообщения для удаления
	addMessageToDelete(userId, sentMessage.message_id);
}

// Обработка нажатия инлайн-кнопки "Рассчитать заказ"
bot.callbackQuery("calculate_order", async (ctx) => {
	await showCategorySelection(ctx);
	await ctx.answerCallbackQuery();
});

// Универсальный обработчик для всех категорий
bot.callbackQuery(/^category_/, async (ctx) => {
	const userId = ctx.from.id;
	const callbackData = ctx.callbackQuery.data; // Получаем данные callback-запроса

	// Извлекаем ключ категории из callback-данных
	const categoryKey = callbackData.replace("category_", "");

	// Получаем информацию о категории
	const categoryInfo = categories[categoryKey];

	if (!categoryInfo) {
		await ctx.reply("Ошибка: категория не найдена.");
		return;
	}

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	// Устанавливаем состояние пользователя
	userStates.set(userId, {
		category: categoryInfo.name, // Используем русское название категории
		markup: categoryInfo.markup, // Сохраняем комиссию
		step: "awaiting_price",
	});

	// Отправляем сообщение с запросом цены
	const sentMessage = await ctx.replyWithAnimation(
		"https://rawcdn.githack.com/guijaffe/strtcode_bot/c7577aeb06e13db1adfb8c7599856fc05a4fb2cf/mp4/price.mp4",
		{
			caption: "Введите цену товара в юанях:"
			})

	// Сохраняем ID сообщения для удаления
	addMessageToDelete(userId, sentMessage.message_id);

	// Отвечаем на callback-запрос
	await ctx.answerCallbackQuery();
});

// Обработка нажатия инлайн-кнопки "Вернуться в главное меню"
bot.callbackQuery("back_to_main_menu", async (ctx) => {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	const sentMessage = await ctx.reply("🏠 Главное меню\n\n" +
	"Добро пожаловать в бот магазина Secret Code!\n\n" +
	"Рады видеть тебя здесь! С помощью этого бота ты сможешь:\n" +
	"✅ Рассчитать стоимость заказа.\n" +
	"✅ Оформить заказ.\n" +
	"✅ Связаться с администратором.\n\n" +
	"Если хочешь узнать больше, нажми «Инструкции».\n\n" +
	"Выбери действие:", {
		reply_markup: mainMenuKeyboard,
	});

	// Сохраняем ID сообщения для удаления
	addMessageToDelete(userId, sentMessage.message_id);

	await ctx.answerCallbackQuery();
});

// Обработка нажатия инлайн-кнопки "Начать оформление заказа"
bot.callbackQuery("start_order", async (ctx) => {
	const userId = ctx.from.id;
	const userState = userStates.get(userId);

	if (userState && userState.step === "awaiting_order_confirmation") {
		// Устанавливаем состояние пользователя
		userState.step = "awaiting_product_link";

		// Отправляем сообщение с запросом ссылки на товар
		const sentMessage = await ctx.replyWithAnimation(
			"https://rawcdn.githack.com/guijaffe/strtcode_bot/76bebe177c432a9760533294729f278a6a6f7770/mp4/link.mp4",
			{
				caption: "Пожалуйста, скиньте ссылку на интересующий товар.",
				reply_markup: new InlineKeyboard().text("Отмена", "back_to_main_menu"),
			}
		);

		// Сохраняем ID сообщения для удаления
		addMessageToDelete(userId, sentMessage.message_id);
	}
	await ctx.answerCallbackQuery();
});

// Функция для извлечения ссылки из текста
function extractLink(text) {
	const urlRegex = /https?:\/\/[^\s]+/g;
	const match = text.match(urlRegex);
	return match ? match[0] : null;
}

// Обработка сообщений от пользователей
bot.on("message", async (ctx) => {
	const userId = ctx.from.id;
	const userState = userStates.get(userId);

	// Если сообщение от администратора
	if (userId.toString() === adminChatId) {
		if (ctx.message.reply_to_message && ctx.message.reply_to_message.message_id) {
			const targetUserId = userStates.get(ctx.message.reply_to_message.message_id);
			if (targetUserId) {
				// Отправляем ответ пользователю
				if (ctx.message.text) {
					await ctx.api.sendMessage(targetUserId, `Ответ от администратора: ${ctx.message.text}`);
				} else if (ctx.message.sticker) {
					await ctx.api.sendSticker(targetUserId, ctx.message.sticker.file_id);
				} else {
					await ctx.api.sendMessage(targetUserId, "Администратор отправил неподдерживаемый тип сообщения.");
				}
			} else {
				console.log("Не удалось определить пользователя для ответа.");
			}
		}
	} else {
		// Добавляем пользователя в список всех пользователей
		allUsers.add(userId);

		// Проверяем состояние пользователя
		if (userState && userState.step === "waiting_for_message_to_admin") {
			const username = ctx.from.username;
			const userLink = username ? `https://t.me/${username}` : `tg://user?id=${userId}`;
			const userName = ctx.from.first_name || ctx.from.username || "Пользователь";

			// Формируем сообщение для администратора
			let adminMessage = `Новое сообщение от пользователя:\n\n` +
				`ID пользователя: <code>${userId}</code>\n` +
				`Ссылка на пользователя: <a href="${userLink}">${userName}</a>\n\n`;

			if (ctx.message.text) {
				adminMessage += `Сообщение: ${ctx.message.text}`;
			} else if (ctx.message.sticker) {
				adminMessage += `Пользователь отправил стикер.`;
			} else {
				adminMessage += `Пользователь отправил неподдерживаемый тип сообщения.`;
			}

			// Отправляем сообщение администратору
			const sentMessage = await ctx.api.sendMessage(adminChatId, adminMessage, {
				parse_mode: "HTML",
			});

			// Если это стикер, пересылаем его администратору
			if (ctx.message.sticker) {
				await ctx.api.sendSticker(adminChatId, ctx.message.sticker.file_id);
			}

			// Сохраняем ID сообщения и ID пользователя
			userStates.set(sentMessage.message_id, userId);

			// Уведомляем пользователя
			await ctx.reply("Ваше сообщение отправлено администратору. Ожидайте ответа.");

			// Сбрасываем состояние пользователя
			userStates.delete(userId);
		} else if (userState && userState.step === "awaiting_price") {
			const price = parseFloat(ctx.message.text);

			if (!isNaN(price) && price > 0) {
				// Получаем курс и комиссию для выбранной категории
				const course = parseFloat(process.env.COURSE);
				const markup = userState.markup || 0;

				// Рассчитываем итоговую стоимость
				const finalPrice = price * course + markup;

				// Сохраняем данные в состоянии пользователя
				userState.price = price;
				userState.finalPrice = finalPrice;
				userState.step = "awaiting_order_confirmation";

				// Показываем пользователю результат расчета
				const calculationMessage = await ctx.reply(
					`Категория: ${userState.category}\n` +
					`Цена в юанях: ${price}\n` +
					`Итоговая цена: ${finalPrice} руб.`,
					{
						reply_markup: orderKeyboard,
					}
				);

				// Сохраняем ID сообщения с расчетом стоимости
				userState.calculationMessageId = calculationMessage.message_id;
			} else {
				await ctx.reply("Пожалуйста, введите корректную цену в юанях.");
			}
		} else if (userState && userState.step === "awaiting_product_link") {
			// Извлекаем ссылку из сообщения
			const productLink = extractLink(ctx.message.text);

			if (productLink) {
				// Сохраняем ссылку на товар
				userState.productLink = productLink;
				userState.step = "awaiting_size";

				// Запрашиваем размер
				const sentMessage = await ctx.replyWithAnimation(
					"https://rawcdn.githack.com/guijaffe/strtcode_bot/76bebe177c432a9760533294729f278a6a6f7770/mp4/size.mp4",
					{
						caption: "Пожалуйста, введите размер товара:",
						reply_markup: new InlineKeyboard().text("Отмена", "back_to_main_menu"),
					}
				);

				// Сохраняем ID сообщения для удаления
				addMessageToDelete(userId, sentMessage.message_id);
			} else {
				await ctx.reply("Пожалуйста, отправьте корректную ссылку на товар. Ссылка должна быть с мобильной версии сайта Poizon (dw4.co).");
			}
		} else if (userState && userState.step === "awaiting_size") {
			// Сохраняем размер
			userState.size = ctx.message.text;
			userState.step = "awaiting_article";

			const sentMessage = await ctx.replyWithAnimation(
				"https://rawcdn.githack.com/guijaffe/strtcode_bot/efa03c97a76e3d33f57fcda568dbd13d5ae2e0a8/mp4/art.mp4",
				{
					caption: "Пожалуйста, введите артикул товара (если не можете найти напишите что угодно):",
					reply_markup: new InlineKeyboard().text("Отмена", "back_to_main_menu"),
				}
			);

			// Сохраняем ID сообщения для удаления
			addMessageToDelete(userId, sentMessage.message_id);
		} else if (userState && userState.step === "awaiting_article") {
			// Сохраняем артикул
			userState.article = ctx.message.text;
			userState.step = "awaiting_confirmation";

			// Показываем пользователю все данные и запрашиваем подтверждение
			const confirmationMessage = await ctx.reply(
				`Ваш заказ:\n\n` +
				`Категория: ${userState.category}\n` +
				`Цена в юанях: ${userState.price}\n` +
				`Итоговая цена: ${userState.finalPrice} руб.\n` +
				`Ссылка на товар: ${userState.productLink}\n` +
				`Размер: ${userState.size}\n` +
				`Артикул: ${userState.article}\n\n` +
				`Подтвердите заказ или вернитесь в главное меню.`,
				{
					reply_markup: confirmOrderKeyboard,
				}
			);

			// Сохраняем ID сообщения для удаления
			addMessageToDelete(userId, confirmationMessage.message_id);
		} else {
			// Если пользователь не нажал кнопку, напоминаем ему
			await ctx.reply("Нажмите кнопку 'Связаться с администратором', чтобы отправить сообщение.", {
				reply_markup: contactAdminKeyboard,
			});
		}
	}
});

// Обработка нажатия инлайн-кнопки "Подтвердить заказ"
bot.callbackQuery("confirm_order", async (ctx) => {
	const userId = ctx.from.id;
	const userState = userStates.get(userId);

	if (userState && userState.step === "awaiting_confirmation") {
		// Удаляем сообщение с подтверждением
		await deletePreviousMessages(ctx, userId);

		// Сохраняем заказ в файл
		saveOrderToFile(
			userId,
			userState.category,
			userState.price,
			userState.finalPrice,
			userState.productLink,
			userState.size,
			userState.article,
			ctx.from
		);

		// Формируем сообщение для администратора
		const username = ctx.from.username;
		const userLink = username ? `https://t.me/${username}` : `tg://user?id=${userId}`;
		const userName = ctx.from.first_name || ctx.from.username || "Пользователь";
		const adminMessage = `Новый заказ:\n\n` +
			`Категория: ${userState.category}\n` +
			`Цена в юанях: ${userState.price}\n` +
			`Итоговая цена: ${userState.finalPrice} руб.\n` +
			`Ссылка на товар: ${userState.productLink}\n` +
			`Размер: ${userState.size}\n` +
			`Артикул: ${userState.article}\n` +
			`Пользователь: <a href="${userLink}">${userName}</a>\n` +
			`ID пользователя: ${userId}`;

		// Отправляем сообщение администратору
		const sentMessage = await ctx.api.sendMessage(adminChatId, adminMessage, {
			parse_mode: "HTML",
		});

		// Сохраняем ID сообщения и ID пользователя
		userStates.set(sentMessage.message_id, userId);

		// Уведомляем пользователя об успешном оформлении заказа
		const confirmationMessage = await ctx.reply(
			`✅ Ваш заказ успешно оформлен!\n\n` +
			`Категория: ${userState.category}\n` +
			`Цена в юанях: ${userState.price}\n` +
			`Итоговая цена: ${userState.finalPrice} руб.\n` +
			`Ссылка на товар: ${userState.productLink}\n` +
			`Размер: ${userState.size}\n` +
			`Артикул: ${userState.article}\n\n` +
			`Администратор свяжется с вами в ближайшее время для уточнения деталей.`
		);

		// Сохраняем ID сообщения для удаления
		addMessageToDelete(userId, confirmationMessage.message_id);

		// Показываем главное меню
		const menuMessage = await ctx.reply(
			"🏠 Главное меню\n\n" +
			"Спасибо за заказ! Может ещё что-нибудь?\n\n" +
			"Добро пожаловать в бот магазина Secret Code, рады видеть тебя в главном меню снова!\n\n" +
			"Выбери действие:",
			{
				reply_markup: mainMenuKeyboard,
			}
		);

		// Сохраняем ID сообщения для удаления
		addMessageToDelete(userId, menuMessage.message_id);

		// Сбрасываем состояние пользователя
		userStates.delete(userId);
	} else {
		await ctx.reply("Ошибка при оформлении заказа. Попробуйте снова.");
	}
	await ctx.answerCallbackQuery();
});

// Обработка нажатия инлайн-кнопки "Рассчитать еще"
bot.callbackQuery("calculate_again", async (ctx) => {
	await showCategorySelection(ctx);
	await ctx.answerCallbackQuery();
});

// Обработка нажатия инлайн-кнопки "Связаться с администратором"
bot.callbackQuery("contact_admin", async (ctx) => {
	const userId = ctx.from.id;

	// Устанавливаем состояние пользователя
	userStates.set(userId, { step: "waiting_for_message_to_admin" });

	await ctx.reply("Напишите ваше сообщение администратору:");
	await ctx.answerCallbackQuery();
});

// Сохранение заказа в файл orders.json
function saveOrderToFile(userId, category, price, finalPrice, productLink, size, article, userData) {
	const order = {
		userId,
		username: userData.username || null, // Юзернейм
		firstName: userData.first_name || null, // Имя
		lastName: userData.last_name || null, // Фамилия
		category,
		price,
		finalPrice,
		productLink,
		size,
		article,
		timestamp: new Date().toLocaleString("ru-RU", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		}),
	};

	const ordersPath = path.resolve("orders.json");
	let orders = [];

	// Чтение существующих заказов
	if (fs.existsSync(ordersPath)) {
		orders = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));
	}

	// Добавление нового заказа
	orders.push(order);

	// Сохранение обновленного списка заказов
	fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
}
// Обработка ошибок
bot.catch((err) => {
	console.error("Ошибка в боте:", err);
});

// Запуск бота
bot.start();