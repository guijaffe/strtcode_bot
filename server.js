import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const ordersPath = path.resolve(__dirname, "orders.json");

// Создаём файл, если он отсутствует
if (!fs.existsSync(ordersPath)) {
	fs.writeFileSync(ordersPath, "[]"); // Пустой массив заказов
}

// Временное хранилище для восстановления заказов
let pendingDeletion = null;

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

// Обновление статуса заказа
app.post("/orders/update", (req, res) => {
	const { orderId, status } = req.body;

	try {
		let orders = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));

		// Находим заказ
		const order = orders.find((o) => o.userId.toString() === orderId.toString());
		if (order) {
			order.status = status; // Обновляем статус
			fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
			res.json({ success: true });
		} else {
			res.status(404).json({ success: false, message: "Order not found" });
		}
	} catch (error) {
		console.error("Ошибка при обновлении статуса:", error);
		res.status(500).json({ success: false, message: "Ошибка при обновлении статуса" });
	}
});

// Добавление заметки к заказу
app.post("/orders/add-note", (req, res) => {
	const { orderId, note } = req.body;

	try {
		let orders = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));

		// Находим заказ
		const order = orders.find((o) => o.userId.toString() === orderId.toString());
		if (order) {
			order.note = note; // Обновляем заметку
			fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
			res.json({ success: true });
		} else {
			res.status(404).json({ success: false, message: "Order not found" });
		}
	} catch (error) {
		console.error("Ошибка при сохранении заметки:", error);
		res.status(500).json({ success: false, message: "Ошибка при сохранении заметки" });
	}
});

// Удаление заказа с возможностью восстановления
app.post("/orders/delete", (req, res) => {
	const { orderId } = req.body;

	try {
		let orders = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));

		// Находим заказ
		const order = orders.find((o) => o.userId.toString() === orderId.toString());
		if (order) {
			// Сохраняем заказ для возможного восстановления
			pendingDeletion = order;

			// Удаляем заказ из основного списка
			orders = orders.filter((o) => o.userId.toString() !== orderId.toString());
			fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));

			res.json({ success: true, pendingDeletion: pendingDeletion });
		} else {
			res.status(404).json({ success: false, message: "Order not found" });
		}
	} catch (error) {
		console.error("Ошибка при удалении заказа:", error);
		res.status(500).json({ success: false, message: "Ошибка при удалении заказа" });
	}
});

// Восстановление заказа
app.post("/orders/restore", (req, res) => {
	if (pendingDeletion) {
		const order = pendingDeletion;

		try {
			let orders = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));

			// Восстанавливаем заказ
			orders.push(order);
			fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));

			// Сбрасываем временное хранилище
			pendingDeletion = null;

			res.json({ success: true });
		} catch (error) {
			console.error("Ошибка при восстановлении заказа:", error);
			res.status(500).json({ success: false, message: "Ошибка при восстановлении заказа" });
		}
	} else {
		res.status(404).json({ success: false, message: "No order to restore" });
	}
});

app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});