import { Field, ID, ObjectType } from 'type-graphql'

@ObjectType()
class VisibleContent {
  @Field((type) => ID)
  id: string

  @Field()
  approved: false
}
