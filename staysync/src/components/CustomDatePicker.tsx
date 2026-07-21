import React from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { Calendar } from 'lucide-react';
import './CustomDatePicker.css';

interface CustomDatePickerProps {
  selectedDate: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  required?: boolean;
}

export function CustomDatePicker({ selectedDate, onChange, placeholder = "Select date", required = false }: CustomDatePickerProps) {
  return (
    <div className="custom-datepicker-wrapper">
      <div className="custom-datepicker-icon">
        <Calendar size={16} />
      </div>
      <DatePicker
        selected={selectedDate}
        onChange={onChange}
        dateFormat="dd-MM-yyyy"
        placeholderText={placeholder}
        className="custom-datepicker-input"
        calendarClassName="custom-datepicker-calendar"
        required={required}
        showPopperArrow={false}
        popperPlacement="bottom-start"
        withPortal
      />
    </div>
  );
}
