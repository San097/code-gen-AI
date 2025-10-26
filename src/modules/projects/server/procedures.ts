import { prisma } from "@/lib/db";
import { inngest } from "@/inngest/client";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { z } from "zod";
import { generateSlug } from "random-word-slugs";
import { consumeCredits } from "@/lib/usage";
import { TRPCError } from "@trpc/server";

export const projectsRouter = createTRPCRouter({
    getMany : protectedProcedure
    .query(async ({ ctx}) => {
        const projects = await prisma.project.findMany({
            where: {
                userId: ctx.auth.userId
            },
           orderBy: {
            updatedAt: "desc",
           },
        });
        return projects;
    }),
    getOne: protectedProcedure
    .input(z.object({
        id: z.string()
    }))
    .query(async ({ input, ctx }) => {
        const project = await prisma.project.findUnique({
            where: {
                id: input.id,
                userId: ctx.auth.userId,
            },
            include: {
                messages: {
                    orderBy: {
                        createdAt: "asc"
                    }
                }
            }
        });
        return project;
    }),
  create: protectedProcedure
    .input(
      z.object({
        value: z.string()
        .min(1, { message: "value is required" })
        .max(10000, { message: "value is too long" }),
      })
    )
    .mutation(async ({ input, ctx }) => {
           try {
      await consumeCredits();
      } catch (error) {
        if(error instanceof Error){
          throw new TRPCError({ code: "BAD_REQUEST", message: "Something went wrong" });
        }else{
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "You have run out of credits",
          })
        }
      }
        const createdProject = await prisma.project.create({
            data: {
                userId: ctx.auth.userId,
                name:generateSlug(2, {
                    format: "kebab",
                }),
                messages: {
                    create: {
                        content: input.value,
                        role: "USER",
                        type: "RESULT",
                    }
                }
            }
        });

      await inngest.send({
        name: "code-agent/run",
        data: {
          value: input.value,
          projectId: createdProject.id,
        },
      });

      return createdProject;
    }),
});
