import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

function todayForDateInput() {
  return new Date().toLocaleDateString("en-CA");
}

export default function InvoiceForm() {
  const createInvoice = useMutation(api.features.invoices.mutations.create);
  const [storeName, setStoreName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayForDateInput);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!storeName || !amount || !date) return;

    await createInvoice({
      store_name: storeName,
      paid_amount: Number(amount) * 1000,
      date,
    });

    setStoreName("");
    setAmount("");
    setDate(todayForDateInput());
  };

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <input
        type="text"
        className="input-field"
        placeholder="Tên quán (vd: Cơm sườn)"
        value={storeName}
        onChange={(event) => setStoreName(event.target.value)}
        required
      />
      <input
        type="number"
        className="input-field"
        placeholder="Tổng tiền (đ)"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        required
      />
      <input
        type="date"
        className="input-field"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        required
      />
      <button type="submit" className="submit-btn small-btn">
        Thêm
      </button>
    </form>
  );
}
