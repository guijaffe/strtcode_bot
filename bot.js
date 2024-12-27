// Подключение переменных окружения
require('dotenv').config();
const { Bot, Keyboard, InlineKeyboard } = require("grammy");

// Инициализация бота
const bot = new Bot(process.env.BOT_TOKEN); // Используем BOT_TOKEN из .env
const exchangeRate = parseFloat(process.env.COURSE); // Курс для расчета
const adminChatId = process.env.ADMIN_CHAT_ID; // Укажите ваш реальный ID

// Состояние пользователя
const userState = {};

// Таблица цен
const productPrices = {
	'Кроссовки': 2000,
	'Зимняя обувь': 2300,
	'Худи': 2000,
	'Зимняя куртка': 2500,
	'Ветровка': 1900,
	'Джинсы': 1850,
	'Сумки маленькие': 2000,
	'Сумки большие': 2100,
	'Футболки, шорты, аксессуары': 1800,
	'Часы, парфюм, украшения': 1800,
};

// Главное меню
const mainMenu = new Keyboard()
	.text("Инструкция").row()
	.text("Рассчитать заказ").text("Оформить заказ").row()
	.text("Связаться с администратором")
	.resized();

// Меню расчета
const calculateMenu = new Keyboard()
	.text("Кроссовки").text("Зимняя обувь").row()
	.text("Худи").text("Зимняя куртка").row()
	.text("Ветровка").row()
	.text("В начало")
	.resized();

// Хранение чатов
const userChats = {}; // Храним ID чатов для каждого пользователя с администратором
const adminUsers = {}; // Храним пользователей, с которыми администратор может общаться
let selectedUserId = null; // Переменная для хранения выбранного пользователя

// Главное меню
bot.command("start", async (ctx) => {
	userState[ctx.chat.id] = {}; // Сбрасываем состояние
	await ctx.reply("Привет! Добро пожаловать в бота. Выберите действие:", {
		reply_markup: mainMenu,
	});
});

// Инструкция
bot.hears("Инструкция", async (ctx) => {
	await ctx.reply(
		"Инструкция:\n1. Выберите 'Рассчитать заказ', чтобы указать товары.\n2. Оформите заказ после расчета.\n3. Следуйте дальнейшим указаниям.",
		{ reply_markup: mainMenu }
	);
});

// Рассчитать заказ
bot.hears("Рассчитать заказ", async (ctx) => {
	userState[ctx.chat.id] = { step: "category" }; // Устанавливаем шаг
	await ctx.reply("Выберите категорию товара:", { reply_markup: calculateMenu });
});

// Выбор категории
bot.hears(Object.keys(productPrices), async (ctx) => {
	const product = ctx.message.text;
	userState[ctx.chat.id] = { product, step: "price" };

	await ctx.reply(
		`Вы выбрали "${product}". Теперь введите цену товара (в юанях):`,
		{ reply_markup: new Keyboard().text("Назад").text("В начало").resized() }
	);
});

// Оформить заказ
bot.hears("Оформить заказ", async (ctx) => {
	const userId = ctx.chat.id;
	const state = userState[userId];

	if (!state || !state.product || !state.price) {
		return await ctx.reply("Для оформления заказа необходимо сначала рассчитать стоимость.");
	}

	try {
		const message = `Новый заказ от ${ctx.from.first_name} ${
			ctx.from.last_name || ""
		} (${ctx.from.username || "Без имени"}):
      Продукт: ${state.product}
      Цена в юанях: ${state.price}
      Итоговая цена: ${(state.price * exchangeRate + productPrices[state.product]).toFixed(2)} руб.`;

		await bot.api.sendMessage(adminChatId, message);

		await ctx.reply(
			"Ваш заказ оформлен. Администратор скоро подключится для подтверждения.",
			{ reply_markup: mainMenu }
		);
	} catch (error) {
		console.error("Ошибка при отправке сообщения администратору: ", error);
		await ctx.reply("Произошла ошибка при отправке сообщения администратору.");
	}
});

// Связаться с администратором
bot.hears("Связаться с администратором", async (ctx) => {
	const userId = ctx.chat.id;

	// Создаем новый чат с администратором для каждого пользователя
	const userChat = await bot.api.sendMessage(adminChatId, `Пользователь ${ctx.from.first_name} ${ctx.from.last_name || ""} (${ctx.from.username || "Без имени"}) хочет связаться с вами.`);

	// Сохраняем ID чата для этого пользователя и его имя
	userChats[userId] = {
		chatId: userChat.chat.id,
		userName: ctx.from.first_name
	};

	// Добавляем пользователя в список активных пользователей для админа
	adminUsers[userId] = { userId, userName: ctx.from.first_name };

	await ctx.reply("Ваш запрос отправлен администратору. Ожидайте ответа.");
});

// Обработка сообщений от админа
bot.on("message", async (ctx) => {
	const chatId = ctx.chat.id;

	// Проверка, отправляется ли сообщение администратором
	if (chatId === parseInt(adminChatId)) {
		// Проверяем, выбран ли пользователь для ответа
		if (selectedUserId !== null) {
			// Если сообщение — это текст
			if (ctx.message.text) {
				await bot.api.sendMessage(
					selectedUserId,
					`Сообщение от администратора: ${ctx.message.text}`
				);
			}
			// Если сообщение — это стикер
			if (ctx.message.sticker) {
				const stickerId = ctx.message.sticker.file_id; // Получаем file_id стикера
				await bot.api.sendSticker(selectedUserId, stickerId);
			}

			selectedUserId = null; // Сбрасываем выбор пользователя
			return await ctx.reply(`Сообщение отправлено пользователю ${ctx.from.first_name || ctx.from.username}.`);
		}

		// Получаем ID всех пользователей, с которыми администратор может общаться
		const activeUsers = Object.keys(userChats);

		if (activeUsers.length === 0) {
			return await ctx.reply("Нет активных пользователей для общения.");
		}

		// Создаем инлайн клавиатуру для выбора пользователя
		const userKeyboard = new InlineKeyboard();
		activeUsers.forEach((userId) => {
			const userName = adminUsers[userId] ? adminUsers[userId].userName : 'Неизвестно';
			userKeyboard.text(`Ответить ${userName}`, `Ответить_${userId}`);
		});

		// Отправляем администратору список пользователей для выбора
		await ctx.reply("Выберите пользователя для ответа:", {
			reply_markup: userKeyboard,
		});
	} else {
		// Пересылаем сообщения от пользователей администратору в его чат
		if (userChats[chatId]) {
			// Если сообщение — это текст
			if (ctx.message.text) {
				await bot.api.sendMessage(
					userChats[chatId].chatId, // Исправлено: используем chatId, связанный с пользователем
					`Сообщение от пользователя ${ctx.from.first_name} (${ctx.from.username || "Без имени"}): ${ctx.message.text}`
				);
			}

			// Если сообщение — это стикер
			if (ctx.message.sticker) {
				const stickerId = ctx.message.sticker.file_id; // Получаем file_id стикера
				const userName = ctx.from.first_name || ctx.from.username; // Получаем имя отправителя
				await bot.api.sendMessage(
					userChats[chatId].chatId,
					`Стикер от пользователя ${userName}:`
				);
				await bot.api.sendSticker(userChats[chatId].chatId, stickerId);
			}
		} else {
			await ctx.reply("Вы не связаны с администратором. Нажмите 'Связаться с администратором' для начала общения.");
		}
	}
});

// Обработка выбора пользователя для ответа
bot.on("callback_query", async (ctx) => {
	const callbackData = ctx.callbackQuery.data;

	if (callbackData.startsWith("Ответить_")) {
		const userId = callbackData.split("_")[1];
		const userName = adminUsers[userId] ? adminUsers[userId].userName : 'Неизвестно';

		selectedUserId = userId; // Сохраняем ID выбранного пользователя
		await ctx.answerCallbackQuery();
		await ctx.reply(`Вы выбрали пользователя ${userName} для ответа. Напишите ваше сообщение.`);
	}
});

// Запуск бота
bot.start();
console.log("Бот запущен!");
