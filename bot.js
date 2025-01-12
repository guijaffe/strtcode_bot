import { Bot, InlineKeyboard } from "grammy";
import "dotenv/config";
import fs from "fs";
import path from "path";

// Инициализация бота
const bot = new Bot(process.env.BOT_TOKEN);

// ID администратора
const adminChatId = process.env.ADMIN_CHAT_ID;

// Хранение состояния пользователей (временное, для примера)
const userStates = new Map();

// Хранение всех пользователей бота
const allUsers = new Set();

// Категории товаров и их наценки
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
	.text("Оформить заказ", "place_order")
	.row()
	.text("Рассчитать еще", "calculate_again")
	.row()
	.text("Вернуться в главное меню", "back_to_main_menu");

// Инлайн-клавиатура для инструкций
const instructionsKeyboard = new InlineKeyboard()
	.text("На главную", "back_to_main_menu");

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
	console.log(`Пользователь ${userId} добавлен в allUsers. Текущее количество пользователей: ${allUsers.size}`);

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
		await ctx.reply("⚠️ Пожалуйста, введите текст для рассылки.\nПример: /broadcast Новые товары уже в продаже!");
		return;
	}

	let successCount = 0;
	let failCount = 0;

	// Рассылка всем пользователям
	for (const user of allUsers) {
		try {
			console.log(`Попытка отправить сообщение пользователю ${user}`);
			await ctx.api.sendMessage(user, `📢 Сообщение от администрации:\n\n${messageText}`);
			successCount++;
		} catch (error) {
			console.error(`Не удалось отправить сообщение пользователю ${user}:`, error);
			failCount++;
		}
	}

	await ctx.reply(`✅ Рассылка завершена.\n✔️ Успешно: ${successCount}\n❌ Ошибки: ${failCount}`);
});

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

// Обработка нажатия инлайн-кнопки "Оформить заказ"
bot.callbackQuery("place_order", async (ctx) => {
	const userId = ctx.from.id;
	const userState = userStates.get(userId);

	if (userState && userState.step === "awaiting_order_confirmation") {
		const { category, price, finalPrice, calculationMessageId } = userState;

		// Удаляем сообщение с расчетом стоимости
		if (calculationMessageId) {
			try {
				await ctx.api.deleteMessage(ctx.chat.id, calculationMessageId);
			} catch (error) {
				console.error("Не удалось удалить сообщение с расчетом:", error);
			}
		}

		// Формируем сообщение для администратора
		const userLink = `tg://user?id=${userId}`;
		const userName = ctx.from.first_name || ctx.from.username || "Пользователь";
		const adminMessage = `Новый заказ:\n\n` +
			`Категория: ${category}\n` +
			`Цена в юанях: ${price}\n` +
			`Итоговая цена: ${finalPrice} руб.\n` +
			`Пользователь: <a href="${userLink}">${userName}</a>\n` +
			`ID пользователя: ${userId}`;

		// Отправляем сообщение администратору
		const sentMessage = await ctx.api.sendMessage(adminChatId, adminMessage, {
			parse_mode: "HTML",
		});

		// Сохраняем заказ в файл orders.json
		saveOrderToFile(userId, category, price, finalPrice);

		// Сохраняем ID сообщения и ID пользователя
		userStates.set(sentMessage.message_id, userId);

		// Уведомляем пользователя об успешном оформлении заказа
		const confirmationMessage = await ctx.reply(
			`✅ Ваш заказ успешно оформлен!\n\n` +
			`Категория: ${category}\n` +
			`Итоговая цена: ${finalPrice} руб.\n\n` +
			`Администратор свяжется с вами в ближайшее время для уточнения деталей.`
		);

		// Сохраняем ID сообщения для удаления
		addMessageToDelete(userId, confirmationMessage.message_id);

		// Показываем главное меню
		const menuMessage = await ctx.reply("🏠 Главное меню\n\n" +
			"Спасибо за заказ! Может ещё что-нибудь?\n\n" +
			"Добро пожаловать в бот магазина Secret Code, рады видеть тебя в главном меню снова!\n\n" +
			"Выбери действие:", {
			reply_markup: mainMenuKeyboard,
		});

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

// Обработка сообщений от пользователей
bot.on("message", async (ctx) => {
	const userId = ctx.from.id;
	const userState = userStates.get(userId);

	// Если сообщение от администратора
	if (userId.toString() === adminChatId) {
		// Обработка ответов администратора
		if (ctx.message.reply_to_message) {
			const targetUserId = userStates.get(ctx.message.reply_to_message.message_id);

			if (targetUserId) {
				// Отправляем ответ пользователю
				if (ctx.message.text) {
					await ctx.api.sendMessage(targetUserId, `Ответ от администратора: ${ctx.message.text}`);
				} else if (ctx.message.sticker) {
					await ctx.api.sendSticker(targetUserId, ctx.message.sticker.file_id);
				} else {
					// Если это другой тип сообщения (фото, видео и т.д.)
					await ctx.api.sendMessage(targetUserId, "Администратор отправил неподдерживаемый тип сообщения.");
				}

				// Уведомляем администратора об успешной отправке
				await ctx.reply("Сообщение успешно отправлено пользователю.");
			}
		}
	} else {
		// Обработка сообщений от пользователей
		allUsers.add(userId);

		if (userState && userState.step === "waiting_for_message_to_admin") {
			// Проверяем тип сообщения
			if (ctx.message.voice || ctx.message.video_note) {
				// Уведомляем пользователя, что голосовые и видеокружки не поддерживаются
				await ctx.reply("Извините, голосовые сообщения и видеокружки не поддерживаются. Пожалуйста, отправьте текстовое сообщение.");
				return; // Прекращаем обработку этого сообщения
			}

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
				parse_mode: "HTML",
			});

			// Пересылаем медиафайлы администратору (кроме голосовых и видеокружков)
			if (ctx.message.sticker) {
				await ctx.api.sendSticker(adminChatId, ctx.message.sticker.file_id);
			}

			// Сохраняем ID сообщения и ID пользователя
			userStates.set(sentMessage.message_id, userId);

			// Уведомляем пользователя
			await ctx.reply("Ваше сообщение отправлено администратору. Ожидайте ответа.");

			// Сбрасываем состояние пользователя
			userStates.delete(userId);
		}
	}
});


// Сохранение заказа в файл orders.json
function saveOrderToFile(userId, category, price, finalPrice) {
	const order = {
		userId,
		category,
		price,
		finalPrice,
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