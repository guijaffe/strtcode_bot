import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 11031;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const ordersPath = path.resolve(__dirname, "orders.json");
const usersPath = path.resolve(__dirname, "users.json");
const adminMessagesPath = path.resolve(__dirname, "adminMessages.json");

// Создаём файлы, если они отсутствуют
if (!fs.existsSync(ordersPath)) fs.writeFileSync(ordersPath, "[]");
if (!fs.existsSync(usersPath)) fs.writeFileSync(usersPath, "[]");
if (!fs.existsSync(adminMessagesPath)) fs.writeFileSync(adminMessagesPath, "[]");

// Хранилище для временно удаленных заказов
const pendingDeletions = new Map();

// Получение списка заказов
app.get("/orders", (req, res) => {
	try {
		const orders = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));
		// Сортировка по времени (новые сверху)
		orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
		res.json(orders);
	} catch (error) {
		console.error("Ошибка при чтении orders.json:", error);
		res.status(500).json({ success: false, message: "Ошибка при загрузке заказов" });
	}
});


// Удаление заказа с возможностью восстановления
app.post("/orders/delete", (req, res) => {
	const { orderId } = req.body;

	try {
		let orders = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));
		const orderIndex = orders.findIndex((o) => o.userId.toString() === orderId.toString());

		if (orderIndex !== -1) {
			const [deletedOrder] = orders.splice(orderIndex, 1);
			pendingDeletions.set(orderId, deletedOrder);
			fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));

			// Удаление из временного хранилища через 5 секунд
			setTimeout(() => {
				if (pendingDeletions.has(orderId)) {
					pendingDeletions.delete(orderId);
				}
			}, 5000);

			res.json({ success: true });
		} else {
			res.status(404).json({ success: false, message: "Заказ не найден" });
		}
	} catch (error) {
		console.error("Ошибка при удалении заказа:", error);
		res.status(500).json({ success: false, message: "Ошибка при удалении заказа" });
	}
});

// Восстановление заказа
app.post("/orders/restore", (req, res) => {
	const { orderId } = req.body;

	if (pendingDeletions.has(orderId)) {
		const order = pendingDeletions.get(orderId);

		try {
			let orders = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));

			// Восстанавливаем заказ
			orders.push(order);
			fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));

			// Удаляем заказ из временного хранилища
			pendingDeletions.delete(orderId);

			res.json({ success: true });
		} catch (error) {
			console.error("Ошибка при восстановлении заказа:", error);
			res.status(500).json({ success: false, message: "Ошибка при восстановлении заказа" });
		}
	} else {
		res.status(404).json({ success: false, message: "Заказ для восстановления не найден" });
	}
});

// Сохранение заметки
app.post("/orders/save-note", (req, res) => {
	const { orderId, note } = req.body;

	try {
		let orders = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));
		const orderIndex = orders.findIndex((o) => o.userId.toString() === orderId.toString());

		if (orderIndex !== -1) {
			orders[orderIndex].note = note;
			fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
			res.json({ success: true });
		} else {
			res.status(404).json({ success: false, message: "Заказ не найден" });
		}
	} catch (error) {
		console.error("Ошибка при сохранении заметки:", error);
		res.status(500).json({ success: false, message: "Ошибка при сохранении заметки" });
	}
});

// Обновление статуса заказа
app.post("/orders/update-status", (req, res) => {
	const { orderId, status } = req.body;

	try {
		let orders = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));
		const orderIndex = orders.findIndex((o) => o.userId.toString() === orderId.toString());

		if (orderIndex !== -1) {
			orders[orderIndex].status = status;
			fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
			res.json({ success: true });
		} else {
			res.status(404).json({ success: false, message: "Заказ не найден" });
		}
	} catch (error) {
		console.error("Ошибка при обновлении статуса:", error);
		res.status(500).json({ success: false, message: "Ошибка при обновлении статуса" });
	}
});

// Получение всех пользователей
app.get("/users", (req, res) => {
	try {
		const users = JSON.parse(fs.readFileSync(usersPath, "utf-8"));
		// Сортировка по времени (новые сверху)
		users.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
		res.json(users);
	} catch (error) {
		console.error("Ошибка при чтении users.json:", error);
		res.status(500).json({ success: false, message: "Ошибка при загрузке данных пользователей" });
	}
});

// Получение всех сообщений администратору
app.get("/admin-messages", (req, res) => {
	try {
		const messages = JSON.parse(fs.readFileSync(adminMessagesPath, "utf-8"));
		// Сортировка по времени (новые сверху)
		messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
		res.json(messages);
	} catch (error) {
		console.error("Ошибка при чтении adminMessages.json:", error);
		res.status(500).json({ success: false, message: "Ошибка при загрузке сообщений администратору" });
	}
});

// Запуск сервера
app.listen(port, () => {
	console.log(`Сервер запущен на http://localhost:${port}`);
});