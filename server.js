import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { allUsers, adminMessages } from "./bot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 11031;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const ordersPath = path.resolve(__dirname, "orders.json");

// Создаём файл, если он отсутствует
if (!fs.existsSync(ordersPath)) {
	fs.writeFileSync(ordersPath, "[]"); // Пустой массив заказов
}

// Хранилище для временно удаленных заказов
const pendingDeletions = new Map();

// Получение списка заказов
app.get("/orders", (req, res) => {
	try {
		const orders = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));
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
		const orderIndex = orders.findIndex(o => o.userId.toString() === orderId.toString());

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
		const orderIndex = orders.findIndex(o => o.userId.toString() === orderId.toString());

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
		const orderIndex = orders.findIndex(o => o.userId.toString() === orderId.toString());

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
		const users = Array.from(allUsers.entries()).map(([userId, userData]) => ({
			userId,
			...userData,
		}));
		res.json(users);
	} catch (error) {
		console.error("Ошибка при чтении данных пользователей:", error);
		res.status(500).json({ success: false, message: "Ошибка при загрузке данных пользователей" });
	}
});

// Получение всех сообщений администратору
app.get("/admin-messages", (req, res) => {
	try {
		res.json(adminMessages);
	} catch (error) {
		console.error("Ошибка при чтении сообщений администратору:", error);
		res.status(500).json({ success: false, message: "Ошибка при загрузке сообщений администратору" });
	}
});

// Запуск сервера
app.listen(port, () => {
	console.log(`Сервер запущен на http://localhost:${port}`);
});