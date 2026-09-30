import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { toast } from "../../../shared/lib/toast";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { allocateProportionally } from "../../../../convex/features/orders/allocation";
import {
  containsOnlyArithmeticCharacters,
  evaluateArithmeticExpression,
} from "../lib/arithmetic";

const formatVnd = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const formatPercentage = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 1,
});

type CounterpartyMenuPosition = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

function todayForDateInput() {
  return new Date().toLocaleDateString("en-CA");
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .replace(/đ/g, "d");
}

function parseMemberPrice(expression: string, hasInvalidCharacters: boolean) {
  const priceThousands = evaluateArithmeticExpression(expression);
  const itemPrice = (priceThousands ?? 0) * 1000;

  if (hasInvalidCharacters) {
    return { itemPrice, isValid: false, error: "Chỉ nhập số và phép tính." };
  }
  if (!expression.trim()) {
    return { itemPrice, isValid: false, error: "" };
  }
  if (priceThousands === null || !Number.isFinite(itemPrice)) {
    return { itemPrice, isValid: false, error: "Biểu thức chưa hoàn chỉnh hoặc không hợp lệ." };
  }
  if (priceThousands <= 0) {
    return { itemPrice, isValid: false, error: "Giá món phải lớn hơn 0." };
  }

  return { itemPrice, isValid: true, error: "" };
}

type InvoiceFormProps = {
  onSaved: () => void;
  onCancel: () => void;
  initialInvoice?: Doc<"invoices">;
  initialOrders?: Array<{
    user_id: Id<"users">;
    item_price: number;
  }>;
};

export default function InvoiceForm({
  onSaved,
  onCancel,
  initialInvoice,
  initialOrders = [],
}: InvoiceFormProps) {
  const activeUsers = useQuery(api.features.users.queries.getActive, {});
  const createInvoice = useMutation(api.features.invoices.mutations.create);
  const updateInvoice = useMutation(api.features.invoices.mutations.updateWithOrders);
  const isEditing = Boolean(initialInvoice);
  const [invoiceType, setInvoiceType] = useState<"receivable" | "payable">(
    initialInvoice?.invoice_type ?? "receivable",
  );
  const [storeName, setStoreName] = useState(initialInvoice?.store_name ?? "");
  const [amount, setAmount] = useState(
    initialInvoice ? String(initialInvoice.paid_amount / 1000) : "",
  );
  const [date, setDate] = useState(initialInvoice?.date ?? todayForDateInput);
  const [memberSearch, setMemberSearch] = useState("");
  const [counterpartyId, setCounterpartyId] = useState(
    initialInvoice?.invoice_type === "payable" ? initialOrders[0]?.user_id ?? "" : "",
  );
  const [counterpartySearch, setCounterpartySearch] = useState("");
  const [isCounterpartyMenuOpen, setIsCounterpartyMenuOpen] = useState(false);
  const counterpartyTriggerRef = useRef<HTMLButtonElement>(null);
  const counterpartyPanelRef = useRef<HTMLDivElement>(null);
  const counterpartySearchRef = useRef<HTMLInputElement>(null);
  const [counterpartyMenuPosition, setCounterpartyMenuPosition] =
    useState<CounterpartyMenuPosition | null>(null);
  const [memberPrices, setMemberPrices] = useState<Record<string, string>>(() =>
    initialInvoice?.invoice_type !== "payable"
      ? Object.fromEntries(
          initialOrders.map((order) => [order.user_id, String(order.item_price / 1000)]),
        )
      : {},
  );
  const [invalidPriceInputs, setInvalidPriceInputs] = useState<Record<string, boolean>>({});
  const [invalidAmountInput, setInvalidAmountInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const sortedUsers = [...(activeUsers ?? [])].sort((left, right) =>
    left.name.localeCompare(right.name, "vi", { sensitivity: "base" }),
  );
  const searchTerm = normalizeName(memberSearch.trim());
  const visibleUsers = sortedUsers.filter((user) =>
    normalizeName(user.name).includes(searchTerm),
  );
  const selectedUsers = sortedUsers.filter(
    (user) => memberPrices[user._id] !== undefined,
  );
  const selectedCounterparty = sortedUsers.find(
    (user) => user._id === counterpartyId,
  );
  const visibleCounterparties = sortedUsers.filter((user) =>
    normalizeName(user.name).includes(normalizeName(counterpartySearch.trim())),
  );

  useLayoutEffect(() => {
    if (!isCounterpartyMenuOpen) {
      setCounterpartyMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      const trigger = counterpartyTriggerRef.current;
      if (!trigger) return;

      const edge = 12;
      const gap = 8;
      const rect = trigger.getBoundingClientRect();
      const scrollBody = trigger.closest(".invoice-composer-body");
      const bodyRect = scrollBody?.getBoundingClientRect();
      const visibleTop = Math.max(edge, bodyRect?.top ?? edge);
      const visibleBottom = Math.min(
        window.innerHeight - edge,
        bodyRect?.bottom ?? window.innerHeight - edge,
      );
      if (rect.bottom < visibleTop || rect.top > visibleBottom) {
        setIsCounterpartyMenuOpen(false);
        return;
      }

      const spaceBelow = visibleBottom - rect.bottom - gap;
      const spaceAbove = rect.top - gap - visibleTop;
      const openAbove = spaceBelow < 240 && spaceAbove > spaceBelow;
      const availableSpace = openAbove ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(96, Math.min(320, availableSpace));
      const width = Math.min(rect.width, window.innerWidth - edge * 2);
      const left = Math.max(
        edge,
        Math.min(rect.left, window.innerWidth - width - edge),
      );
      const nextPosition: CounterpartyMenuPosition = {
        left,
        width,
        maxHeight,
        ...(openAbove
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
      };

      setCounterpartyMenuPosition((current) =>
        current &&
        current.left === nextPosition.left &&
        current.width === nextPosition.width &&
        current.maxHeight === nextPosition.maxHeight &&
        current.top === nextPosition.top &&
        current.bottom === nextPosition.bottom
          ? current
          : nextPosition,
      );
    };

    updateMenuPosition();
    counterpartySearchRef.current?.focus();

    const resizeObserver = new ResizeObserver(updateMenuPosition);
    if (counterpartyTriggerRef.current) {
      resizeObserver.observe(counterpartyTriggerRef.current);
      const scrollBody = counterpartyTriggerRef.current.closest(".invoice-composer-body");
      if (scrollBody) resizeObserver.observe(scrollBody);
    }
    if (counterpartyPanelRef.current) {
      resizeObserver.observe(counterpartyPanelRef.current);
    }
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    window.visualViewport?.addEventListener("resize", updateMenuPosition);
    window.visualViewport?.addEventListener("scroll", updateMenuPosition);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.visualViewport?.removeEventListener("resize", updateMenuPosition);
      window.visualViewport?.removeEventListener("scroll", updateMenuPosition);
    };
  }, [isCounterpartyMenuOpen]);

  useEffect(() => {
    if (!isCounterpartyMenuOpen) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        (counterpartyTriggerRef.current?.contains(target) ||
          counterpartyPanelRef.current?.contains(target))
      ) {
        return;
      }

      setIsCounterpartyMenuOpen(false);
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    };
  }, [isCounterpartyMenuOpen]);
  const pricedUsers = selectedUsers.map((user) => {
    const parsedPrice = parseMemberPrice(
      memberPrices[user._id] ?? "",
      invalidPriceInputs[user._id] ?? false,
    );
    return { user, ...parsedPrice };
  });
  const itemTotal = pricedUsers.reduce((sum, item) => sum + item.itemPrice, 0);
  const roundedItemTotal = Math.round(itemTotal);
  const amountThousands = evaluateArithmeticExpression(amount);
  const amountInVnd = Math.round((amountThousands ?? 0) * 1000);
  const isAmountValid =
    !invalidAmountInput &&
    amountThousands !== null &&
    Number.isFinite(amountInVnd) &&
    Number.isSafeInteger(amountInVnd) &&
    amountInVnd > 0;
  let amountError = "";
  if (invalidAmountInput) {
    amountError = "Chỉ dùng chữ số, dấu thập phân và phép tính +, -, *, /, ngoặc.";
  } else if (amount.trim() && amountThousands === null) {
    amountError = "Biểu thức chưa hoàn chỉnh hoặc không hợp lệ.";
  } else if (amountThousands !== null && !Number.isSafeInteger(amountInVnd)) {
    amountError = "Kết quả vượt giới hạn có thể lưu.";
  } else if (amountThousands !== null && amountInVnd <= 0) {
    amountError = "Tổng hóa đơn phải lớn hơn 0.";
  }
  const arePricesValid =
    pricedUsers.length > 0 &&
    pricedUsers.every(({ isValid, itemPrice }) => isValid && Number.isFinite(itemPrice)) &&
    Number.isFinite(itemTotal);

  let preview: ReturnType<typeof allocateProportionally> = [];
  if (invoiceType === "receivable" && isAmountValid && arePricesValid) {
    try {
      preview = allocateProportionally(
        amountInVnd,
        pricedUsers.map(({ itemPrice }) => itemPrice),
      );
    } catch {
      preview = [];
    }
  }

  const canSave =
    activeUsers !== undefined &&
    storeName.trim().length > 0 &&
    date.length > 0 &&
    isAmountValid &&
    (invoiceType === "receivable"
      ? arePricesValid && preview.length === pricedUsers.length
      : Boolean(selectedCounterparty)) &&
    !isSaving;

  const toggleMember = (userId: string, selected: boolean) => {
    setMemberPrices((current) => {
      const next = { ...current };
      if (selected) next[userId] = "";
      else delete next[userId];
      return next;
    });
    setInvalidPriceInputs((current) => ({ ...current, [userId]: false }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;

    setIsSaving(true);

    try {
      const orders =
        invoiceType === "payable"
          ? selectedCounterparty
            ? [{ user_id: selectedCounterparty._id, item_price: amountInVnd }]
            : []
          : pricedUsers.map(({ user, itemPrice }) => ({
              user_id: user._id,
              item_price: itemPrice,
            }));

      if (initialInvoice) {
        await updateInvoice({
          id: initialInvoice._id,
          store_name: storeName.trim(),
          paid_amount: amountInVnd,
          date,
          orders,
        });
        toast.success("Đã cập nhật hóa đơn và các phần ăn.");
      } else {
        await createInvoice({
          store_name: storeName.trim(),
          paid_amount: amountInVnd,
          invoice_type: invoiceType,
          date,
          orders,
        });

        setStoreName("");
        setAmount("");
        setDate(todayForDateInput());
        setMemberPrices({});
        setCounterpartyId("");
        setCounterpartySearch("");
        setIsCounterpartyMenuOpen(false);
        setInvoiceType("receivable");
        toast.success(
          invoiceType === "payable"
            ? `Đã ghi nhận khoản phải trả cho ${selectedCounterparty?.name}.`
            : `Đã lưu hóa đơn cùng ${pricedUsers.length} phần ăn.`,
        );
      }
      onSaved();
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "Không thể lưu hóa đơn. Vui lòng thử lại.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <form className={`invoice-composer${isEditing ? " invoice-editor" : ""}`} onSubmit={handleSubmit}>
      <div className="invoice-composer-heading">
        <div>
          <h3 id="invoice-form-title">{isEditing ? "Chỉnh sửa hóa đơn" : "Tạo hóa đơn"}</h3>
          <p>
            {invoiceType === "receivable"
              ? "Bạn ứng tiền trước; khoản phải thu được phân bổ theo giá món từng thành viên."
              : "Thành viên đã ứng tiền; ghi nhận số tiền bạn cần hoàn lại cho người đó."}
          </p>
        </div>
        <div className="invoice-form-header-actions">
          {isEditing ? (
            <span className={`invoice-type-badge ${invoiceType}`}>
              {invoiceType === "payable" ? "Phải trả" : "Phải thu"}
            </span>
          ) : (
            <fieldset className="invoice-type-picker">
              <legend className="visually-hidden">Loại hóa đơn</legend>
              <label className={invoiceType === "receivable" ? "selected" : ""}>
                <input
                  type="radio"
                  name="invoice-type"
                  value="receivable"
                  checked={invoiceType === "receivable"}
                  onChange={() => setInvoiceType("receivable")}
                />
                <span>Phải thu</span>
              </label>
              <label className={invoiceType === "payable" ? "selected" : ""}>
                <input
                  type="radio"
                  name="invoice-type"
                  value="payable"
                  checked={invoiceType === "payable"}
                  onChange={() => setInvoiceType("payable")}
                />
                <span>Phải trả</span>
              </label>
            </fieldset>
          )}
          <button
            type="button"
            className="invoice-modal-close"
            aria-label="Đóng biểu mẫu hóa đơn"
            onClick={onCancel}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>
      </div>

      <div className="invoice-composer-body">
        <div className="invoice-composer-fields">
        <label className="invoice-field">
          <span>Quán / nội dung hóa đơn</span>
          <input
            type="text"
            className="input-field"
            placeholder="Ví dụ: Cơm sườn"
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
            maxLength={120}
            required
          />
        </label>

        <div className="invoice-field">
          <div className="invoice-field-label-row">
            <label htmlFor="invoice-total-amount">
              {invoiceType === "receivable" ? "Tổng hóa đơn" : "Số tiền bạn phải trả"}{" "}
              <small>(nghìn đồng)</small>
            </label>
            <span className="invoice-help">
              <button
                type="button"
                className="invoice-help-trigger"
                aria-label="Hướng dẫn nhập tổng hóa đơn"
                aria-describedby="invoice-amount-tooltip"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <circle cx="10" cy="10" r="8" />
                  <path d="M10 9v5M10 6.2h.01" />
                </svg>
              </button>
              <span className="invoice-tooltip" id="invoice-amount-tooltip" role="tooltip">
                Nhập số hoặc phép tính (+, -, *, /, ngoặc). Dấu phẩy hoặc chấm dùng cho số thập phân; kết quả tính theo nghìn đồng.
              </span>
            </span>
          </div>
          <input
            id="invoice-total-amount"
            type="text"
            className="input-field"
            placeholder="Ví dụ: 120+35"
            inputMode="text"
            value={amount}
            aria-describedby={amountError ? "invoice-amount-error" : undefined}
            onChange={(event) => {
              const nextAmount = event.target.value;
              if (containsOnlyArithmeticCharacters(nextAmount)) {
                setAmount(nextAmount);
                setInvalidAmountInput(false);
              } else {
                setInvalidAmountInput(true);
              }
            }}
            aria-invalid={Boolean(amountError)}
            required
          />
          {amountError ? (
            <small className="invoice-field-error" id="invoice-amount-error" role="status">
              {amountError}
            </small>
          ) : null}
        </div>

        <label className="invoice-field">
          <span>Ngày hóa đơn</span>
          <input
            type="date"
            className="input-field"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
        </div>

        <div className="invoice-composer-columns">
        <fieldset className="invoice-member-section">
          <legend>{invoiceType === "receivable" ? "Thành viên và giá món" : "Người bạn nợ"}</legend>

          {activeUsers === undefined ? (
            <p className="invoice-muted" role="status">Đang tải danh sách thành viên…</p>
          ) : activeUsers.length === 0 ? (
            <p className="invoice-muted">
              Chưa có thành viên hoạt động. <Link to="/users">Quản lý thành viên</Link>
            </p>
          ) : invoiceType === "payable" ? (
            <div className="invoice-counterparty-picker">
              <p className="invoice-section-hint">
                Chọn người đã ứng tiền và nhập phần tiền bạn cần hoàn lại cho họ.
              </p>
              <div className="invoice-counterparty-field">
                <span className="invoice-counterparty-label">Chủ nợ</span>
                <div
                  className="invoice-combobox"
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && isCounterpartyMenuOpen) {
                      event.preventDefault();
                      event.stopPropagation();
                      setIsCounterpartyMenuOpen(false);
                      counterpartyTriggerRef.current?.focus();
                    }
                  }}
                >
                  <button
                    type="button"
                    ref={counterpartyTriggerRef}
                    id="invoice-counterparty"
                    className={`invoice-combobox-trigger${isCounterpartyMenuOpen ? " open" : ""}`}
                    aria-expanded={isCounterpartyMenuOpen}
                    aria-controls="invoice-counterparty-menu"
                    aria-label={`Chủ nợ: ${selectedCounterparty?.name ?? "chưa chọn"}`}
                    onClick={() => {
                      if (isCounterpartyMenuOpen) {
                        setIsCounterpartyMenuOpen(false);
                      } else {
                        setCounterpartySearch("");
                        setIsCounterpartyMenuOpen(true);
                      }
                    }}
                  >
                    <span className={selectedCounterparty ? "" : "placeholder"}>
                      {selectedCounterparty?.name ?? "Chọn thành viên…"}
                    </span>
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="m5 7.5 5 5 5-5" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <label className="invoice-member-search">
                <span className="visually-hidden">Tìm thành viên</span>
                <input
                  type="search"
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Tìm thành viên theo tên…"
                />
              </label>
              {visibleUsers.length === 0 ? (
                <p className="invoice-muted" role="status">
                  Không tìm thấy thành viên khớp “{memberSearch}”.
                </p>
              ) : (
                <div className="invoice-member-list">
                  {visibleUsers.map((user) => {
                    const isSelected = memberPrices[user._id] !== undefined;
                    const expression = memberPrices[user._id] ?? "";
                    const price = parseMemberPrice(
                      expression,
                      invalidPriceInputs[user._id] ?? false,
                    );
                    const inputId = `invoice-member-${user._id}`;
                    const errorId = `${inputId}-error`;
                    const showPriceError = isSelected && Boolean(price.error);
                    const showInvalidPrice =
                      isSelected &&
                      (Boolean(expression.trim()) || invalidPriceInputs[user._id]) &&
                      !price.isValid;

                    return (
                      <div
                        className={`invoice-member-row${isSelected ? " selected" : ""}`}
                        key={user._id}
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) => toggleMember(user._id, event.target.checked)}
                        />
                        <label htmlFor={inputId}>{user.name}</label>
                        <div className="invoice-member-price">
                          <div className="invoice-member-price-control">
                            <input
                              type="text"
                              inputMode="text"
                              aria-label={`Giá món của ${user.name}, tính theo nghìn đồng`}
                              aria-invalid={showInvalidPrice}
                              aria-describedby={showPriceError ? errorId : undefined}
                              placeholder="Giá món"
                              value={expression}
                              disabled={!isSelected}
                              required={isSelected}
                              onChange={(event) => {
                                const nextPrice = event.target.value;
                                if (containsOnlyArithmeticCharacters(nextPrice)) {
                                  setMemberPrices((current) => ({
                                    ...current,
                                    [user._id]: nextPrice,
                                  }));
                                setInvalidPriceInputs((current) => ({
                                  ...current,
                                  [user._id]: false,
                                }));
                                } else {
                                  setInvalidPriceInputs((current) => ({
                                    ...current,
                                    [user._id]: true,
                                  }));
                                }
                              }}
                            />
                            <span>nghìn</span>
                          </div>
                          {showPriceError ? (
                            <small className="invoice-price-error" id={errorId} role="status">
                              {price.error}
                            </small>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </fieldset>

        <section className="invoice-preview-section" aria-labelledby="invoice-preview-title">
          <div className="invoice-preview-heading">
            <h4 id="invoice-preview-title">
              {invoiceType === "receivable" ? "Phân bổ trước khi lưu" : "Khoản phải trả trước khi lưu"}
            </h4>
            {invoiceType === "receivable" ? (
              <span className="invoice-help">
                <button
                  type="button"
                  className="invoice-help-trigger"
                  aria-label="Cách phân bổ hóa đơn"
                  aria-describedby="invoice-allocation-tooltip"
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <circle cx="10" cy="10" r="8" />
                    <path d="M10 9v5M10 6.2h.01" />
                  </svg>
                </button>
                <span className="invoice-tooltip" id="invoice-allocation-tooltip" role="tooltip">
                  Mỗi người trả theo tỷ lệ giá món. Chênh lệch với tổng hóa đơn được phân bổ theo cùng tỷ lệ để tổng tiền luôn khớp hóa đơn.
                </span>
              </span>
            ) : null}
          </div>

          {invoiceType === "payable" && isAmountValid && selectedCounterparty ? (
            <div className="invoice-payable-preview">
              <div>
                <span>Bạn nợ</span>
                <strong>{selectedCounterparty.name}</strong>
              </div>
              <div>
                <span>Số tiền phải trả</span>
                <strong className="invoice-share-amount">{formatVnd.format(amountInVnd)}</strong>
              </div>
            </div>
          ) : invoiceType === "receivable" && isAmountValid && arePricesValid ? (
            <>
              <div className="invoice-allocation-summary">
                <div>
                  <span>Tổng hóa đơn</span>
                  <strong>{formatVnd.format(amountInVnd)}</strong>
                </div>
                <div>
                  <span>Tổng giá món nhập</span>
                  <strong>{formatVnd.format(Math.round(itemTotal))}</strong>
                </div>
                <div>
                  <span>
                    {roundedItemTotal === amountInVnd
                      ? "Đã khớp hóa đơn"
                      : roundedItemTotal < amountInVnd
                        ? "Hóa đơn cao hơn"
                        : "Giá món cao hơn"}
                  </span>
                  <strong className={roundedItemTotal <= amountInVnd ? "" : "over-budget"}>
                    {formatVnd.format(Math.abs(amountInVnd - roundedItemTotal))}
                  </strong>
                </div>
              </div>
              <ul className="invoice-allocation-list">
                {pricedUsers.map(({ user, itemPrice }, index) => (
                  <li key={user._id}>
                    <div>
                      <strong>{user.name}</strong>
                      <span>
                        Giá món {formatVnd.format(Math.round(itemPrice))} · {formatPercentage.format(preview[index]?.percentage ?? 0)}%
                      </span>
                    </div>
                    <strong className="invoice-share-amount">
                      {formatVnd.format(preview[index]?.amount ?? 0)}
                    </strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="invoice-preview-empty">
              {invoiceType === "payable"
                ? !selectedCounterparty
                  ? "Chọn người đã ứng tiền để xem khoản phải trả."
                  : "Nhập số tiền hợp lệ để xem khoản phải trả."
                : selectedUsers.length === 0
                  ? "Chọn thành viên và nhập giá món để xem số tiền phân bổ."
                  : "Nhập tổng hóa đơn và giá món hợp lệ để xem số tiền phân bổ."}
            </div>
          )}
        </section>
        </div>
      </div>

      <div className="invoice-composer-footer">
        <button type="submit" className="submit-btn" disabled={!canSave}>
          {isSaving
            ? "Đang lưu…"
            : isEditing
              ? "Lưu thay đổi"
              : invoiceType === "receivable"
                ? "Lưu hóa đơn và phần ăn"
                : "Lưu khoản phải trả"}
        </button>
      </div>
    </form>
    {isCounterpartyMenuOpen && counterpartyMenuPosition
      ? createPortal(
          <div
            ref={counterpartyPanelRef}
            className="invoice-combobox-panel"
            id="invoice-counterparty-menu"
            role="dialog"
            aria-label="Tìm và chọn chủ nợ"
            data-modal-portal=""
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setIsCounterpartyMenuOpen(false);
                counterpartyTriggerRef.current?.focus();
              }
            }}
            style={{
              position: "fixed",
              zIndex: 1200,
              left: counterpartyMenuPosition.left,
              right: "auto",
              width: counterpartyMenuPosition.width,
              maxHeight: counterpartyMenuPosition.maxHeight,
              ...(counterpartyMenuPosition.top !== undefined
                ? { top: counterpartyMenuPosition.top, bottom: "auto" }
                : { top: "auto", bottom: counterpartyMenuPosition.bottom }),
            }}
          >
            <label className="invoice-combobox-search">
              <span className="visually-hidden">Tìm chủ nợ theo tên</span>
              <input
                ref={counterpartySearchRef}
                type="search"
                value={counterpartySearch}
                onChange={(event) => setCounterpartySearch(event.target.value)}
                placeholder="Tìm thành viên…"
              />
            </label>
            <div className="invoice-combobox-options" id="invoice-counterparty-options">
              {visibleCounterparties.length > 0 ? (
                visibleCounterparties.map((user) => (
                  <button
                    type="button"
                    className={`invoice-combobox-option${counterpartyId === user._id ? " selected" : ""}`}
                    aria-pressed={counterpartyId === user._id}
                    key={user._id}
                    onClick={() => {
                      setCounterpartyId(user._id);
                      setCounterpartySearch("");
                      setIsCounterpartyMenuOpen(false);
                      counterpartyTriggerRef.current?.focus();
                    }}
                  >
                    <span>{user.name}</span>
                    {counterpartyId === user._id ? <span aria-hidden="true">✓</span> : null}
                  </button>
                ))
              ) : (
                <p className="invoice-combobox-empty" role="status">
                  Không tìm thấy thành viên phù hợp.
                </p>
              )}
            </div>
          </div>,
          document.body,
        )
      : null}
    </>
  );
}
