package com.rappi.farmer.application.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class MessageTemplateDto {
    private Long id;
    private String name;
    private String content;

    @Override
    public String toString() {
        return name;
    }
}
