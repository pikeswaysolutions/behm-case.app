import * as React from "react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const DateInput = React.forwardRef(
  ({ value, onChange, className, ...props }, ref) => {
    const dateValue = value ? format(value, "yyyy-MM-dd") : "";

    const handleChange = (e) => {
      const newValue = e.target.value;
      if (newValue) {
        try {
          const parsed = parseISO(newValue);
          onChange?.(parsed);
        } catch (err) {
        }
      }
    };

    return (
      <Input
        ref={ref}
        type="date"
        value={dateValue}
        onChange={handleChange}
        className={cn("w-[150px]", className)}
        {...props}
      />
    );
  }
);

DateInput.displayName = "DateInput";

export { DateInput };
