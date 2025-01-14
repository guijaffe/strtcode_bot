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

async function loadOrders() {
	try {
		const response = await fetch("/orders");
		if (!response.ok) {
			throw new Error("Ошибка при загрузке заказов");
		}
		const orders = await response.json();

		const tbody = document.querySelector("#ordersTableBody");
		tbody.innerHTML = "";

		orders.forEach(order => {
			const row = document.createElement("tr");
			row.innerHTML = `
                <td class="user-data">
                    <div><strong>ID:</strong> ${order.userId}</div>
                    ${order.username ? `<div><strong>Юзернейм:</strong> @${order.username}</div>` : ''}
                    ${order.firstName ? `<div><strong>Имя:</strong> ${order.firstName}</div>` : ''}
                    ${order.lastName ? `<div><strong>Фамилия:</strong> ${order.lastName}</div>` : ''}
                    <div><strong>Ссылка:</strong> <a href="tg://user?id=${order.userId}">Написать</a></div>
                </td>
                <td>${order.category}</td>
                <td>${order.price}</td>
                <td>${order.finalPrice}</td>
                <td><a href="${order.productLink}" target="_blank">Ссылка</a></td>
                <td>${order.size}</td>
                <td>${order.article}</td>
                <td>${order.timestamp}</td>
                <td>
                    <select onchange="updateStatus('${order.userId}', this.value)">
                        <option value="new" ${order.status === 'new' ? 'selected' : ''}>Новый</option>
                        <option value="in_progress" ${order.status === 'in_progress' ? 'selected' : ''}>В процессе</option>
                        <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Завершен</option>
                    </select>
                </td>
                <td>
                    <textarea class="note">${order.note || ''}</textarea>
                    <button onclick="saveNote('${order.userId}', this.previousElementSibling.value)">Сохранить</button>
                </td>
                <td>
                    <button class="delete" onclick="deleteOrder('${order.userId}')">Удалить</button>
                </td>
            `;
			tbody.appendChild(row);
		});
	} catch (error) {
		console.error("Ошибка при загрузке заказов:", error);
		alert("Ошибка при загрузке заказов. Проверьте консоль для подробностей.");
	}
}

// Получение всех пользователей, нажавших /start
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

app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});