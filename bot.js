// Подключение переменных окружения
require('dotenv').config();
const { Bot, Keyboard } = require("grammy");

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

// // Меню после расчета
// const postCalculationMenu = new Keyboard()
// 	.text("Оформить заказ").text("Назад").row()
// 	.text("В начало")
// 	.resized();


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
        Итоговая цена: ${(state.price * exchangeRate + productPrices[state.product]).toFixed(
			2
		)} руб.`;

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
	const message = `Пользователь ${ctx.from.first_name} ${ctx.from.last_name || ""} (${ctx.from.username || "Без имени"}) хочет связаться для оформления заказа.`;

	try {
		await bot.api.sendMessage(adminChatId, message);
		await ctx.reply("Ваш запрос отправлен админу. Ожидайте ответа.");
	} catch (error) {
		console.error("Ошибка при отправке сообщения админу:", error);
		await ctx.reply("Не удалось связаться с администратором.");
	}
});

// Запуск бота
bot.start();
console.log("Бот запущен!");