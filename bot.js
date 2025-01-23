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

// Хранение всех пользователей, нажавших /start
const allUsers = new Map();

// Хранение сообщений пользователей администратору
const adminMessages = [];

bot.command("removekeyboard", async (ctx) => {
	const userId = ctx.from.id.toString();

	// Проверка на администратора
	if (userId !== adminChatId) {
		await ctx.reply("❌ У вас нет прав для этой команды.");
		return;
	}

	// Чтение пользователей из users.json
	const users = readJsonFile("users.json");

	let successCount = 0;
	let failCount = 0;

	// Рассылка команды удаления клавиатуры всем пользователям
	for (const user of users) {
		try {
			await ctx.api.sendMessage(user.userId, "Удаляем клавиатуру...", {
				reply_markup: { remove_keyboard: true }, // Удаляем клавиатуру
			});
			successCount++;
		} catch (error) {
			console.error(`Не удалось удалить клавиатуру у пользователя ${user.userId}:`, error);
			failCount++;
		}
	}

	await ctx.reply(
		`✅ Клавиатура удалена у пользователей.\n✔️ Успешно: ${successCount}\n❌ Ошибки: ${failCount}`
	);
});

const categories = {
	sneakers: { name: "Кроссовки", markup: 3000 },
	winter_shoes: { name: "Зимняя обувь", markup: 3300 },
	t_shirts: { name: "Футболка", markup: 2800 },
	windbreaker: { name: "Ветровка, бомбер", markup: 3000 },
	hoodie: { name: "Худи, свитер, кофта", markup: 3000 },
	jacket: { name: "Куртка ", markup: 3000 },
	winter_jacket: { name: "Зимняя куртка", markup: 3500 },
	coat: { name: "Пальто", markup: 3100 },
	accessories: { name: "Аксессуары", markup: 2900 },
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
	.text("F.A.Q.", "show_faq")
	.row()
	// .text("Отзывы", "show_reviews")
	// .row()
	.text("Связаться с администратором", "contact_admin");

// Инлайн-клавиатура для выбора категории
const categoryKeyboard = new InlineKeyboard()
	.text("Кроссовки", "category_sneakers")
	.row()
	.text("Зимняя обувь", "category_winter_shoes")
	.row()
	.text("Футболки", "category_t_shirts")
	.row()
	.text("Худи, свитер, кофта", "category_hoodie")
	.row()
	.text("Ветровка, бомбер", "category_windbreaker")
	.row()
	.text("Куртка", "category_jacket")
	.row()
	.text("Зимняя куртка", "category_winter_jacket")
	.row()
	.text("Пальто", "category_coat")
	.row()
	.text("Аксессуары", "category_accessories")
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
	.text("Регистрация в приложении Poizon", "registration_instructions")
	.row()
	.text("Инструкция по использованию Poizon", "poizon_instructions")
	.row()
	.text("Как пользоваться сервисом", "service_instructions")
	.row()
	.text("Инструкция по использованию бота", "bot_instructions")
	.row()
	.text("На главную", "back_to_main_menu");

// Инлайн-клавиатура для инструкции по боту (без кнопки "Инструкция по использованию бота")
const botInstructionsKeyboard = new InlineKeyboard()
	.text("Назад", "show_instructions")
	.row()
	.text("На главную", "back_to_main_menu");

// Инлайн-клавиатура для инструкции по Poizon (без кнопки "Инструкция по использованию Poizon")
const poizonInstructionsKeyboard = new InlineKeyboard()
	.text("Назад", "show_instructions")
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
		userState.previousMessages = []; // Очищаем список сообщений
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

// Функция для чтения данных из JSON-файла
function readJsonFile(filePath) {
	if (!fs.existsSync(filePath)) {
		fs.writeFileSync(filePath, "[]");
	}
	const data = fs.readFileSync(filePath, "utf-8");
	return JSON.parse(data);
}

// Функция для записи данных в JSON-файл
function writeJsonFile(filePath, data) {
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

bot.command("start", async (ctx) => {
	const userId = ctx.from.id;
	const username = ctx.from.username || "Нет юзернейма";
	const firstName = ctx.from.first_name || "Нет имени";
	const lastName = ctx.from.last_name || "Нет фамилии";

	// Сохраняем информацию о пользователе
	const userData = {
		userId,
		username,
		firstName,
		lastName,
		timestamp: new Date().toLocaleString("ru-RU", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			timeZone: "Europe/Moscow",
		}),
	};

	// Чтение текущих данных из users.json
	const users = readJsonFile("users.json");

	// Проверяем, есть ли пользователь в файле
	const userExists = users.some((user) => user.userId === userId);
	if (!userExists) {
		users.push(userData);
		writeJsonFile("users.json", users);
	}

	// Обновляем allUsers
	allUsers.set(userId, userData);

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

bot.command("broadcast", async (ctx) => {
	const userId = ctx.from.id.toString();

	// Проверка на администратора
	if (userId !== adminChatId) {
		await ctx.reply("❌ У вас нет прав для этой команды.");
		return;
	}

	// Проверяем, есть ли медиафайл (фото, документ или альбом)
	const hasPhoto = ctx.message.photo;
	const hasDocument = ctx.message.document;
	const hasMediaGroup = ctx.message.media_group;

	// Если есть медиафайл, обрабатываем его
	if (hasPhoto || hasDocument || hasMediaGroup) {
		let mediaFileId, mediaType;

		if (hasPhoto) {
			mediaType = "photo";
			mediaFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id; // Берем самое большое фото
		} else if (hasDocument) {
			mediaType = "document";
			mediaFileId = ctx.message.document.file_id;
		} else if (hasMediaGroup) {
			// Если это альбом, обрабатываем только первый элемент
			const mediaGroup = ctx.message.media_group;
			if (mediaGroup.length > 0) {
				const firstMedia = mediaGroup[0];
				if (firstMedia.photo) {
					mediaType = "photo";
					mediaFileId = firstMedia.photo[firstMedia.photo.length - 1].file_id;
				} else if (firstMedia.document) {
					mediaType = "document";
					mediaFileId = firstMedia.document.file_id;
				}
			}
		}

		const caption = ctx.message.caption || ""; // Текст под фото (если есть)

		// Чтение пользователей из users.json
		const users = readJsonFile("users.json");

		let successCount = 0;
		let failCount = 0;

		// Рассылка медиафайла всем пользователям
		for (const user of users) {
			try {
				if (mediaType === "photo") {
					await ctx.api.sendPhoto(user.userId, mediaFileId, {
						caption: caption, // Текст под фото
					});
				} else if (mediaType === "document") {
					await ctx.api.sendDocument(user.userId, mediaFileId, {
						caption: caption, // Текст под документом
					});
				}
				successCount++;
			} catch (error) {
				console.error(`Не удалось отправить медиафайл пользователю ${user.userId}:`, error);
				failCount++;
			}
		}

		await ctx.reply(
			`✅ Рассылка медиафайла завершена.\n✔️ Успешно: ${successCount}\n❌ Ошибки: ${failCount}`
		);
	} else if (ctx.message.sticker) {
		// Если это стикер, обрабатываем его отдельно
		const stickerFileId = ctx.message.sticker.file_id;

		// Чтение пользователей из users.json
		const users = readJsonFile("users.json");

		let successCount = 0;
		let failCount = 0;

		// Рассылка стикера всем пользователям
		for (const user of users) {
			try {
				await ctx.api.sendSticker(user.userId, stickerFileId);
				successCount++;
			} catch (error) {
				console.error(`Не удалось отправить стикер пользователю ${user.userId}:`, error);
				failCount++;
			}
		}

		await ctx.reply(
			`✅ Рассылка стикера завершена.\n✔️ Успешно: ${successCount}\n❌ Ошибки: ${failCount}`
		);
	} else {
		// Если нет медиафайла, обрабатываем текстовое сообщение
		const messageText = ctx.message.text.split(" ").slice(1).join(" ");

		if (!messageText) {
			await ctx.reply(
				"⚠️ Пожалуйста, введите текст для рассылки.\nПример: /broadcast Новые товары уже в продаже!"
			);
			return;
		}

		let successCount = 0;
		let failCount = 0;

		// Чтение пользователей из users.json
		const users = readJsonFile("users.json");

		// Рассылка текстового сообщения всем пользователям
		for (const user of users) {
			try {
				await ctx.api.sendMessage(user.userId, `${messageText}`);
				successCount++;
			} catch (error) {
				console.error(`Не удалось отправить сообщение пользователю ${user.userId}:`, error);
				failCount++;
			}
		}

		await ctx.reply(
			`✅ Рассылка завершена.\n✔️ Успешно: ${successCount}\n❌ Ошибки: ${failCount}`
		);
	}
});

// Показ меню инструкций
async function showInstructionsMenu(ctx) {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	const instructionsMenu = `
📖 Выберите инструкцию:

1. **Регистрация в приложении**:
   - Видеоинструкция по регистрации в приложении.

2. **Инструкция по использованию Poizon**:
   - Как пользоваться приложением Poizon для поиска товаров.

3. **Как пользоваться сервисом**:
   - Видеоинструкция по использованию сервиса.

4. **Инструкция по использованию бота**:
   - Как пользоваться ботом для расчета и оформления заказов.
   
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
📖 Инструкция по использованию бота:

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
📖 Инструкция по использованию приложения Poizon:

Для того чтобы научиться пользоваться приложением Poizon, перейдите по ссылке:
👉 [Как пользоваться приложением Poizon](https://telegra.ph/Kak-polzovatsya-prilozheniem-Poizon-01-14)

Там вы найдете подробное руководство с видеоинструкцией по поиску товаров, оформлению заказов и другим функциям приложения.
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

// Обработка нажатия инлайн-кнопки "Регистрация в приложении"
bot.callbackQuery("registration_instructions", async (ctx) => {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	// Отправляем видео
	const videoUrl = "https://rawcdn.githack.com/guijaffe/strtcode_bot/5f5e4ed3f932128851026154898be2d82e4eaa08/mp4/lessons/reg.mp4";

	try {
		// Отправляем видео
		const sentMessage = await ctx.replyWithVideo(videoUrl, {
			caption: "📖 Регистрация в приложении:\n\nПосмотрите видеоинструкцию по регистрации в приложении.",
			reply_markup: new InlineKeyboard()
				.text("Назад", "show_instructions")
				.row()
				.text("На главную", "back_to_main_menu"),
		});

		// Сохраняем ID сообщения для удаления
		addMessageToDelete(userId, sentMessage.message_id);
	} catch (error) {
		console.error("Ошибка при отправке видео:", error);
		await ctx.reply("Не удалось загрузить видео. Пожалуйста, попробуйте позже.");
	}

	await ctx.answerCallbackQuery();
});

// Обработка нажатия инлайн-кнопки "Регистрация в приложении"
bot.callbackQuery("service_instructions", async (ctx) => {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	// Отправляем видео
	const videoUrl = "https://rawcdn.githack.com/guijaffe/strtcode_bot/8e718b0d4779e843837c5a6509e6ccd17d919292/mp4/lessons/urok2.mp4";

	try {
		// Отправляем видео
		const sentMessage = await ctx.replyWithVideo(videoUrl, {
			caption: "📖 Как пользоваться нашим сервисом:\n\nПосмотрите видеоинструкцию по использованию Poizon и Street Code.",
			reply_markup: new InlineKeyboard()
				.text("Назад", "show_instructions")
				.row()
				.text("На главную", "back_to_main_menu"),
		});

		// Сохраняем ID сообщения для удаления
		addMessageToDelete(userId, sentMessage.message_id);
	} catch (error) {
		console.error("Ошибка при отправке видео:", error);
		await ctx.reply("Не удалось загрузить видео. Пожалуйста, попробуйте позже.");
	}

	await ctx.answerCallbackQuery();
});

// Показ F.A.Q.
async function showFAQ(ctx) {
	const userId = ctx.from.id;

	// Удаляем предыдущие сообщения
	await deletePreviousMessages(ctx, userId);

	const faqText = `
❓ По это ссылке собраны все самые частые вопросы, а так же все видео с инструкциями по пользованию и регистрации в приложении.

[F.A.Q. (Часто задаваемые вопросы)](https://telegra.ph/FAQ---CHasto-zadavaemye-voprosy-01-15-3)
`;

	const sentMessage = await ctx.reply(faqText, {
		reply_markup: new InlineKeyboard()
			.text("На главную", "back_to_main_menu"),
		parse_mode: "Markdown", // Включаем Markdown для форматирования
	});

	// Сохраняем ID сообщения для удаления
	addMessageToDelete(userId, sentMessage.message_id);
}

// Обработка нажатия инлайн-кнопки "F.A.Q."
bot.callbackQuery("show_faq", async (ctx) => {
	await showFAQ(ctx);
	await ctx.answerCallbackQuery();
});

// // Показ отзывов
// async function showReviews(ctx) {
// 	const userId = ctx.from.id;
//
// 	// Удаляем предыдущие сообщения
// 	await deletePreviousMessages(ctx, userId);
//
// 	const reviewsText = `
// ⭐ **Отзывы наших клиентов**
//
// 1. **Алексей**:
//    - "Отличный сервис! Быстро оформили заказ, все пришло в срок. Рекомендую!"
//
// 2. **Мария**:
//    - "Очень удобный бот. Все понятно и просто. Спасибо за качественный сервис!"
//
// 3. **Иван**:
//    - "Заказывал кроссовки, все пришло как на фото. Буду обращаться еще!"
//
// ---
//
// Если у вас есть отзыв, напишите его администратору через кнопку "Связаться с администратором".
// `;
//
// 	const sentMessage = await ctx.reply(reviewsText, {
// 		reply_markup: new InlineKeyboard()
// 			.text("На главную", "back_to_main_menu"),
// 		parse_mode: "Markdown", // Включаем Markdown для форматирования
// 	});
//
// 	// Сохраняем ID сообщения для удаления
// 	addMessageToDelete(userId, sentMessage.message_id);
// }
//
// // Обработка нажатия инлайн-кнопки "Отзывы"
// bot.callbackQuery("show_reviews", async (ctx) => {
// 	await showReviews(ctx);
// 	await ctx.answerCallbackQuery();
// });

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
		"https://rawcdn.githack.com/guijaffe/strtcode_bot/86279142c4ea0ee4df17571bec01e9ea2a8464ce/mp4/price.mp4",
		{
			caption: "Введите цену товара в юанях:",
		}
	);

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
		const userData = {
			username: ctx.from.username || null, // Если юзернейма нет, сохраняем null
			firstName: ctx.from.first_name || null, // Если имени нет, сохраняем null
			lastName: ctx.from.last_name || null, // Если фамилии нет, сохраняем null

			timestamp: new Date().toLocaleString("ru-RU", {
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				timeZone: "Europe/Moscow",
			}),
		};
		allUsers.set(userId, userData); // Используем set вместо add

		// Проверяем состояние пользователя
		if (userState && userState.step === "waiting_for_message_to_admin") {
			const username = ctx.from.username;
			const userLink = username ? `https://t.me/${username}` : `tg://user?id=${userId}`;
			const userName = ctx.from.first_name || ctx.from.username || "Пользователь";
			const firstName = ctx.from.first_name || "Нет имени";
			const lastName = ctx.from.last_name || "Нет фамилии";

			// Сохраняем сообщение в adminMessages.json
			const messageData = {
				userId,
				username,
				firstName,
				lastName,
				message: ctx.message.text || "Нет текста",
				timestamp: new Date().toLocaleString("ru-RU", {
					year: "numeric",
					month: "long",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
					timeZone: "Europe/Moscow",
				}),
			};

			const messages = readJsonFile("adminMessages.json");
			messages.push(messageData);
			writeJsonFile("adminMessages.json", messages);

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

				// Удаляем предыдущие сообщения
				await deletePreviousMessages(ctx, userId);

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
				addMessageToDelete(userId, calculationMessage.message_id);
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

				// Удаляем предыдущие сообщения
				await deletePreviousMessages(ctx, userId);

				// Запрашиваем размер
				const sentMessage = await ctx.replyWithAnimation(
					"https://rawcdn.githack.com/guijaffe/strtcode_bot/14dd416b5b421ae2ac31d8c4af1ec678d192b804/mp4/size2.mp4",
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

			// Удаляем предыдущие сообщения
			await deletePreviousMessages(ctx, userId);

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

			// Удаляем предыдущие сообщения
			await deletePreviousMessages(ctx, userId);

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
			timeZone: "Europe/Moscow",
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

// Экспорт переменных для использования в server.js
export { allUsers, adminMessages };

// Запуск бота
bot.start();