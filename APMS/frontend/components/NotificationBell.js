"use client";

import { formatDateTime } from "../lib/date";

export default function NotificationBell({ notifications, onMarkAll }) {
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <details className="notif-wrap">
      <summary>
        Alerts {unread > 0 ? <span className="badge">{unread}</span> : null}
      </summary>
      <div className="notif-panel">
        <div className="notif-head">
          <strong>Notifications</strong>
          <button onClick={onMarkAll}>Mark all read</button>
        </div>
        <div className="notif-list">
          {notifications.length === 0 ? <div className="notif-empty">No notifications</div> : null}
          {notifications.map((n) => (
            <div key={n.id} className={`notif-item ${n.isRead ? "read" : "unread"}`}>
              <div>{n.message}</div>
              <small>{formatDateTime(n.createdAt)}</small>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
