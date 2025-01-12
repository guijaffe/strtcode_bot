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

const categories = {
	"Кроссовки": 2000,
	"Зимняя обувь": 2300,
	"Худи": 2000,
	"Зимняя куртка": 2500,
	"Ветровка": 1900,
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

// Инлайн-клавиатура для инструкций
const instructionsKeyboard = new InlineKeyboard().text(
	"На главную",
	"back_to_main_menu"
);

// Удаление предыдущих сообщений
async function deletePreviousMessages(ctx, userId) {
	const userState = userStates.get(userId);
	if (userState && userState.previousMessages) {
		for (const messageId of userState.previousMessages) {
			try {
				await ctx.api.deleteMessage(ctx.chat.id, messageId);
			} catch (error) {
				console.error("Не удалось удалить сообщение:", error);
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
	console.log("Команда /broadcast вызвана");
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
			console.log(`Попытка отправить сообщение пользователю ${user}`);
			await ctx.api.sendMessage(
				user,
				`📢 Сообщение от администрации:\n\n${messageText}`
			);
			successCount++;
		} catch (error) {
			console.error(
				`Не удалось отправить сообщение пользователю ${user}:`,
				error
			);
			failCount++;
		}
	}

	await ctx.reply(
		`✅ Рассылка завершена.\n✔️ Успешно: ${successCount}\n❌ Ошибки: ${failCount}`
	);
});

// Обработка команды /instructions
bot.command("instructions", async (ctx) => {
	await showInstructions(ctx);
});

// Показ инструкций
async function showInstructions(ctx) {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	const instructions = `
  📖 Инструкции по использованию бота:

  1. Для расчета заказа выберите "Рассчитать заказ".
  2. Выберите категорию товара (например, кроссовки).
  3. Введите цену товара в юанях.
  4. Бот рассчитает стоимость заказа.
  5. Вы можете оформить заказ или вернуться в главное меню.

  Если у вас есть вопросы, свяжитесь с администратором.
  `;

	const sentMessage = await ctx.reply(instructions, {
		reply_markup: instructionsKeyboard,
	});

	// Сохраняем ID сообщения для удаления
	addMessageToDelete(userId, sentMessage.message_id);
}

// Обработка команды /calculate
bot.command("calculate", async (ctx) => {
	await showCategorySelection(ctx);
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

// Обработка нажатия инлайн-кнопки "Инструкции"
bot.callbackQuery("show_instructions", async (ctx) => {
	await showInstructions(ctx);
	await ctx.answerCallbackQuery();
});

// Обработка нажатия инлайн-кнопки "Рассчитать заказ"
bot.callbackQuery("calculate_order", async (ctx) => {
	await showCategorySelection(ctx);
	await ctx.answerCallbackQuery();
});

// Обработка нажатия инлайн-кнопки "Кроссовки"
bot.callbackQuery("category_sneakers", async (ctx) => {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	// Устанавливаем состояние пользователя
	userStates.set(userId, { category: "Кроссовки", step: "awaiting_price" });

	const sentMessage = await ctx.reply("Введите цену товара в юанях:");

	// Сохраняем ID сообщения для удаления
	addMessageToDelete(userId, sentMessage.message_id);

	await ctx.answerCallbackQuery();
});

// Обработка нажатия инлайн-кнопки "Зимняя обувь"
bot.callbackQuery("category_winter_shoes", async (ctx) => {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	// Устанавливаем состояние пользователя
	userStates.set(userId, { category: "Зимняя обувь", step: "awaiting_price" });

	const sentMessage = await ctx.reply("Введите цену товара в юанях:");

	// Сохраняем ID сообщения для удаления
	addMessageToDelete(userId, sentMessage.message_id);

	await ctx.answerCallbackQuery();
});

// Обработка нажатия инлайн-кнопки "Худи"
bot.callbackQuery("category_hoodie", async (ctx) => {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	// Устанавливаем состояние пользователя
	userStates.set(userId, { category: "Худи", step: "awaiting_price" });

	const sentMessage = await ctx.reply("Введите цену товара в юанях:");

	// Сохраняем ID сообщения для удаления
	addMessageToDelete(userId, sentMessage.message_id);

	await ctx.answerCallbackQuery();
});

// Обработка нажатия инлайн-кнопки "Зимняя куртка"
bot.callbackQuery("category_winter_jacket", async (ctx) => {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	// Устанавливаем состояние пользователя
	userStates.set(userId, { category: "Зимняя куртка", step: "awaiting_price" });

	const sentMessage = await ctx.reply("Введите цену товара в юанях:");

	// Сохраняем ID сообщения для удаления
	addMessageToDelete(userId, sentMessage.message_id);

	await ctx.answerCallbackQuery();
});

// Обработка нажатия инлайн-кнопки "Ветровка"
bot.callbackQuery("category_windbreaker", async (ctx) => {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	// Устанавливаем состояние пользователя
	userStates.set(userId, { category: "Ветровка", step: "awaiting_price" });

	const sentMessage = await ctx.reply("Введите цену товара в юанях:");

	// Сохраняем ID сообщения для удаления
	addMessageToDelete(userId, sentMessage.message_id);

	await ctx.answerCallbackQuery();
});

// Обработка нажатия инлайн-кнопки "Вернуться в главное меню"
bot.callbackQuery("back_to_main_menu", async (ctx) => {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	const sentMessage = await ctx.reply("🏠 Главное меню:\n" + "\n" + "Выберите действие:", {
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
		const sentMessage = await ctx.reply(
			"Пожалуйста, скиньте ссылку на интересующий товар. Ссылка должна быть с сайта Poizon (dw4.co).",
			{
				reply_markup: new InlineKeyboard().text("Отмена", "back_to_main_menu"),
			}
		);

		// Сохраняем ID сообщения для удаления
		addMessageToDelete(userId, sentMessage.message_id);
	}
	await ctx.answerCallbackQuery();
});

// Обработка сообщений от пользователей
bot.on("message", async (ctx) => {
	const userId = ctx.from.id;
	const userState = userStates.get(userId);

	// Если сообщение от администратора
	if (userId.toString() === adminChatId) {
		console.log("Администратор отправил сообщение."); // Отладочная информация

		// Проверяем, является ли сообщение ответом на пересланное сообщение
		if (ctx.message.reply_to_message) {
			console.log("Это ответ на пересланное сообщение."); // Отладочная информация

			// Получаем ID пользователя из userStates
			const targetUserId = userStates.get(ctx.message.reply_to_message.message_id);

			if (targetUserId) {
				console.log(`Администратор ответил пользователю ${targetUserId}.`); // Отладочная информация

				// Отправляем ответ пользователю
				if (ctx.message.text) {
					// Если это текстовое сообщение
					await ctx.api.sendMessage(targetUserId, `Ответ от администратора: ${ctx.message.text}`);
				} else if (ctx.message.sticker) {
					// Если это стикер
					await ctx.api.sendSticker(targetUserId, ctx.message.sticker.file_id);
				} else {
					// Если это другой тип сообщения (фото, видео и т.д.)
					await ctx.api.sendMessage(targetUserId, "Администратор отправил неподдерживаемый тип сообщения.");
				}
			} else {
				console.log("Не удалось определить пользователя для ответа."); // Отладочная информация
			}
		} else {
			console.log("Это не ответ на пересланное сообщение."); // Отладочная информация
		}
	} else {
		// Добавляем пользователя в список всех пользователей
		allUsers.add(userId);

		// Проверяем состояние пользователя
		if (userState && userState.step === "waiting_for_message_to_admin") {
			// Создаем ссылку на пользователя
			const userLink = `tg://user?id=${userId}`;

			// Получаем имя пользователя
			const userName = ctx.from.first_name || ctx.from.username || "Пользователь";

			// Формируем сообщение для администратора
			let adminMessage = `Новое сообщение от пользователя:\n\n` +
				`ID пользователя: <code>${userId}</code>\n` +
				`Ссылка на пользователя: <a href="${userLink}">${userName}</a>\n\n`;

			if (ctx.message.text) {
				// Если это текстовое сообщение
				adminMessage += `Сообщение: ${ctx.message.text}`;
			} else if (ctx.message.sticker) {
				// Если это стикер
				adminMessage += `Пользователь отправил стикер.`;
			} else {
				// Если это другой тип сообщения (фото, видео и т.д.)
				adminMessage += `Пользователь отправил неподдерживаемый тип сообщения.`;
			}

			// Отправляем сообщение администратору
			const sentMessage = await ctx.api.sendMessage(adminChatId, adminMessage, {
				parse_mode: "HTML", // Включаем HTML-разметку
			});

			// Если это стикер, пересылаем его администратору
			if (ctx.message.sticker) {
				await ctx.api.sendSticker(adminChatId, ctx.message.sticker.file_id);
			}

			// Сохраняем ID сообщения и ID пользователя
			userStates.set(sentMessage.message_id, userId);

			console.log(`Сообщение от пользователя ${userId} отправлено администратору.`); // Отладочная информация

			// Уведомляем пользователя
			await ctx.reply("Ваше сообщение отправлено администратору. Ожидайте ответа.");

			// Сбрасываем состояние пользователя
			userStates.delete(userId);
		} else if (userState && userState.step === "awaiting_price") {
			const price = parseFloat(ctx.message.text);

			if (!isNaN(price) && price > 0) {
				// Получаем наценку для выбранной категории
				const markup = categories[userState.category] || 0;

				// Рассчитываем итоговую стоимость
				const finalPrice = price * process.env.COURSE + markup;

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
			// Проверяем, что сообщение содержит ссылку
			const productLink = ctx.message.text;

			if (productLink && productLink.startsWith("http")) {
				// Сохраняем ссылку на товар
				userState.productLink = productLink;
				userState.step = "awaiting_size";

				// Запрашиваем размер
				const sentMessage = await ctx.reply("Пожалуйста, введите размер товара:", {
					reply_markup: new InlineKeyboard().text("Отмена", "back_to_main_menu"),
				});

				// Сохраняем ID сообщения для удаления
				addMessageToDelete(userId, sentMessage.message_id);
			} else {
				await ctx.reply("Пожалуйста, отправьте корректную ссылку на товар.");
			}
		} else if (userState && userState.step === "awaiting_size") {
			// Сохраняем размер
			userState.size = ctx.message.text;
			userState.step = "awaiting_article";

			// Запрашиваем артикул
			const sentMessage = await ctx.reply("Пожалуйста, введите артикул товара:", {
				reply_markup: new InlineKeyboard().text("Отмена", "back_to_main_menu"),
			});

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
			userState.article
		);

		// Формируем сообщение для администратора
		const userLink = `tg://user?id=${userId}`;
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
function saveOrderToFile(userId, category, price, finalPrice, productLink, size, article) {
	const order = {
		userId,
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