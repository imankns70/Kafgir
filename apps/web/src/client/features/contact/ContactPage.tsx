'use client'

import { Icon } from '../../design-system/Icon'

type Props = {
  onBack: () => void
}

const contacts = [
  { label: 'پشتیبانی سفارش', phone: '09166450262' },
  { label: 'پیگیری و هماهنگی', phone: '09163442440' },
]

export function ContactPage({ onBack }: Props) {
  return (
    <main className="contact-page">
      <div className="page-actions">
        <div>
          <p className="eyebrow"><Icon name="support" size="sm" /> تماس با ما</p>
          <h1 className="section-title">ارتباط با کفگیر</h1>
        </div>
        <button className="checkout-back-link" onClick={onBack}>
          منوی امروز <Icon name="back" size="sm" />
        </button>
      </div>

      <section className="panel contact-card" aria-label="شماره‌های تماس کفگیر">
        <p className="muted">برای سفارش، پیگیری یا هماهنگی تحویل با شماره‌های زیر تماس بگیرید.</p>
        <div className="contact-list">
          {contacts.map((item) => (
            <a className="contact-link" href={`tel:${item.phone}`} key={item.phone}>
              <span><Icon name="support" size="md" /> {item.label}</span>
              <bdi dir="ltr">{item.phone}</bdi>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}
