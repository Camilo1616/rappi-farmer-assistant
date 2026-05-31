package com.rappi.farmer.application.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ImportResultDto {
    private int total;
    private int created;
    private int updated;
    private int errors;
}
