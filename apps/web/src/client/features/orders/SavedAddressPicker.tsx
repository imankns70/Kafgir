import { useRef } from 'react'
import { Icon } from '../../design-system/Icon'
import type { CustomerAddressDto } from '../../types'
import styles from './SavedAddressPicker.module.css'

type Props = {
  addresses: CustomerAddressDto[]
  selectedAddressId: string
  newAddressValue: string
  onSelect: (value: string) => void
}

function AddressCopy({ address }: { address: CustomerAddressDto }) {
  return <span className={styles.copy}>
    <span className={styles.titleRow}>
      <strong>{address.title}</strong>
      {address.isDefault && <span className={styles.defaultBadge}>پیش‌فرض</span>}
    </span>
    <span className={styles.fullAddress}>{address.city}، {address.addressLine}</span>
  </span>
}

export function SavedAddressPicker({ addresses, selectedAddressId, newAddressValue, onSelect }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const selectedAddress = addresses.find((address) => address.id.toString() === selectedAddressId)

  const select = (value: string) => {
    onSelect(value)
    detailsRef.current?.removeAttribute('open')
  }

  return <label className={styles.field}>
    <span className={styles.label}>آدرس‌های ذخیره‌شده</span>
    <details ref={detailsRef} className={styles.picker}>
      <summary className={styles.summary}>
        <span className={styles.locationIcon}><Icon name={selectedAddress ? 'location' : 'add'} size="sm" /></span>
        {selectedAddress
          ? <AddressCopy address={selectedAddress} />
          : <span className={styles.copy}>
              <span className={styles.titleRow}><strong>افزودن آدرس جدید</strong></span>
              <span className={styles.fullAddress}>نشانی تازه را برای این سفارش وارد کنید.</span>
            </span>}
        <span className={styles.chevron} aria-hidden="true">⌄</span>
      </summary>

      <div className={styles.menu} role="listbox" aria-label="انتخاب آدرس تحویل">
        {addresses.map((address) => {
          const selected = address.id.toString() === selectedAddressId
          return <button
            key={address.id}
            type="button"
            role="option"
            aria-selected={selected}
            className={`${styles.option} ${selected ? styles.selected : ''}`}
            onClick={() => select(address.id.toString())}
          >
            <span className={styles.optionIcon}><Icon name="location" size="sm" /></span>
            <AddressCopy address={address} />
            {selected && <span className={styles.check}><Icon name="confirm" size="sm" /></span>}
          </button>
        })}

        <button
          type="button"
          role="option"
          aria-selected={selectedAddressId === newAddressValue}
          className={`${styles.option} ${styles.newAddress} ${selectedAddressId === newAddressValue ? styles.selected : ''}`}
          onClick={() => select(newAddressValue)}
        >
          <span className={styles.optionIcon}><Icon name="add" size="sm" /></span>
          <span className={styles.copy}>
            <span className={styles.titleRow}><strong>افزودن آدرس جدید</strong></span>
            <span className={styles.fullAddress}>یک نشانی جدید برای تحویل این سفارش ثبت کنید.</span>
          </span>
          {selectedAddressId === newAddressValue && <span className={styles.check}><Icon name="confirm" size="sm" /></span>}
        </button>
      </div>
    </details>
  </label>
}
