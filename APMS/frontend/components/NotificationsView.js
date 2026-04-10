"use client";

import { formatDateTime } from "../lib/date";

export default function NotificationsView({ notifications, onMarkAll }) {
  return (
    <main className="app-shell view-notifications">
      <section className="notifications-page">
        <div className="notif-head">
          <h2>Notifications</h2>
          <button onClick={onMarkAll}>Mark all read</button>
        </div>
        <div className="notif-list notif-list-page">
          {notifications.length === 0 ? (
            <div className="notif-empty">No notifications</div>
          ) : null}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notif-item ${n.isRead ? "read" : "unread"}`}
            >
              <div>{n.message}</div>
              <small>{formatDateTime(n.createdAt)}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
