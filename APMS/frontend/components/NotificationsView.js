"use client";

import { formatDateTime } from "../lib/date";

export default function NotificationsView({ notifications, onMarkAll }) {
  return (
    <main className="app-shell apms-page view-notifications">
      <header className="apms-page-header">
        <div>
          <h1 className="apms-page-title">Notifications</h1>
          <p className="apms-page-subtitle">Lifecycle alerts and system updates in one place.</p>
        </div>
        <button type="button" className="btn-secondary apms-header-btn" onClick={onMarkAll}>
          Mark all read
        </button>
      </header>
      <section className="apms-panel notifications-page">
        <div className="notif-list notif-list-page">
          {notifications.length === 0 ? (
            <div className="notif-empty">No notifications</div>
          ) : null}
          {notifications.map((n) => (
            <article
              key={n.id}
              className={`notif-item ${n.isRead ? "read" : "unread"}`}
            >
              <div className="notif-item-body">{n.message}</div>
              <time className="notif-item-time" dateTime={n.createdAt}>
                {formatDateTime(n.createdAt)}
              </time>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
